import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Milestone,
  MilestoneTemplate,
  Prisma,
  ProjectStatus,
  StatusHistory,
  Timeline,
} from '@prisma/client';
import { MilestoneResponseDto } from 'src/api/milestone/dto/milestone-response.dto';
import { StatusHistoryResponseDto } from 'src/api/milestone/dto/status-history-response.dto';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  publishMilestoneEvent,
  publishNotificationEvent,
  publishTimelineEvent,
} from 'src/shared/utils/event.utils';
import { toSerializable } from '../metadata/utils/metadata-utils';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { TimelineListQueryDto } from './dto/timeline-list-query.dto';
import { TimelineResponseDto } from './dto/timeline-response.dto';
import { UpdateTimelineDto } from './dto/update-timeline.dto';
import { TimelineReferenceService } from './timeline-reference.service';

type MilestoneWithStatusHistory = Milestone & {
  statusHistory?: StatusHistory[];
};

type TimelineWithMilestones = Timeline & {
  milestones: MilestoneWithStatusHistory[];
};

@Injectable()
export class TimelineService {
  private readonly logger = LoggerService.forRoot('TimelineService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineReferenceService: TimelineReferenceService,
  ) {}

  async listTimelines(
    query: TimelineListQueryDto,
  ): Promise<TimelineResponseDto[]> {
    const timelines = await this.prisma.timeline.findMany({
      where: {
        reference: query.reference,
        referenceId: BigInt(query.referenceId),
        deletedAt: null,
      },
      include: this.getMilestoneInclude(),
      orderBy: [{ id: 'asc' }],
    });

    return timelines.map((timeline) =>
      this.toTimelineDto(timeline as TimelineWithMilestones),
    );
  }

  async getTimeline(timelineId: string): Promise<TimelineResponseDto> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');

    const timeline = await this.findTimelineWithMilestones(parsedTimelineId);

    if (!timeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${timelineId}.`,
      );
    }

    return this.toTimelineDto(timeline);
  }

  async createTimeline(
    dto: CreateTimelineDto,
    user: JwtUser,
  ): Promise<TimelineResponseDto> {
    const auditUserId = this.getAuditUserIdBigInt(user);
    const statusAuditUserId = this.getAuditUserIdInt(user);

    this.validateTimelineDateRange(dto.startDate, dto.endDate ?? null);

    const referenceId = BigInt(dto.referenceId);
    const templateId =
      typeof dto.templateId === 'number' ? BigInt(dto.templateId) : null;

    const resolvedContext =
      await this.timelineReferenceService.resolveProjectContextByReference(
        dto.reference,
        referenceId,
      );

    let createdTimelineId = BigInt(0);
    let createdMilestones: Milestone[] = [];

    await this.prisma.$transaction(async (tx) => {
      const createdTimeline = await tx.timeline.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          startDate: dto.startDate,
          endDate: dto.endDate || null,
          reference: dto.reference,
          referenceId,
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      createdTimelineId = createdTimeline.id;

      if (templateId) {
        createdMilestones = await this.createTemplateMilestones(
          tx,
          createdTimeline,
          templateId,
          auditUserId,
          statusAuditUserId,
        );
      }
    });

    const createdTimeline =
      await this.findTimelineWithMilestones(createdTimelineId);

    if (!createdTimeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${createdTimelineId.toString()} after creation.`,
      );
    }

    const response = this.toTimelineDto(createdTimeline);

    this.publishTimelineAction(KAFKA_TOPIC.TIMELINE_ADDED, response);

    for (const milestone of createdMilestones) {
      this.publishMilestoneAction(
        KAFKA_TOPIC.MILESTONE_ADDED,
        this.toMilestoneDto({
          ...milestone,
          statusHistory: [],
        }),
      );
    }

    if (createdMilestones.length > 0) {
      await this.publishTimelineAdjustedNotification(
        resolvedContext.projectId,
        {
          ...response,
          milestones: [],
        },
        response,
        user,
      );
    }

    return response;
  }

  async updateTimeline(
    timelineId: string,
    dto: UpdateTimelineDto,
    user: JwtUser,
  ): Promise<TimelineResponseDto> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const auditUserId = this.getAuditUserIdBigInt(user);

    const existingTimeline =
      await this.findTimelineWithMilestones(parsedTimelineId);

    if (!existingTimeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${timelineId}.`,
      );
    }

    if (
      (typeof dto.reference !== 'undefined' &&
        typeof dto.referenceId === 'undefined') ||
      (typeof dto.reference === 'undefined' &&
        typeof dto.referenceId !== 'undefined')
    ) {
      throw new BadRequestException(
        'reference and referenceId must be provided together.',
      );
    }

    const resolvedReference =
      typeof dto.reference === 'undefined'
        ? existingTimeline.reference
        : dto.reference;
    const resolvedReferenceId =
      typeof dto.referenceId === 'undefined'
        ? existingTimeline.referenceId
        : BigInt(dto.referenceId);

    await this.timelineReferenceService.resolveProjectContextByReference(
      resolvedReference,
      resolvedReferenceId,
    );

    const updatedStartDate = dto.startDate ?? existingTimeline.startDate;
    const updatedEndDate =
      typeof dto.endDate === 'undefined'
        ? existingTimeline.endDate
        : dto.endDate;

    this.validateTimelineDateRange(updatedStartDate, updatedEndDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.timeline.update({
        where: {
          id: parsedTimelineId,
        },
        data: {
          ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
          ...(typeof dto.description === 'undefined'
            ? {}
            : { description: dto.description }),
          ...(typeof dto.startDate === 'undefined'
            ? {}
            : { startDate: dto.startDate }),
          ...(typeof dto.endDate === 'undefined'
            ? {}
            : { endDate: dto.endDate }),
          ...(typeof dto.reference === 'undefined'
            ? {}
            : { reference: dto.reference }),
          ...(typeof dto.referenceId === 'undefined'
            ? {}
            : { referenceId: BigInt(dto.referenceId) }),
          updatedBy: auditUserId,
        },
      });

      const startDateChanged =
        existingTimeline.startDate.getTime() !== updatedStartDate.getTime();

      if (startDateChanged) {
        await this.rescheduleMilestonesForTimeline(
          tx,
          parsedTimelineId,
          updatedStartDate,
          auditUserId,
        );
      }
    });

    const updatedTimeline =
      await this.findTimelineWithMilestones(parsedTimelineId);

    if (!updatedTimeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${timelineId} after update.`,
      );
    }

    const updatedResponse = this.toTimelineDto(updatedTimeline);
    const originalResponse = this.toTimelineDto(existingTimeline);

    this.publishTimelineAction(KAFKA_TOPIC.TIMELINE_UPDATED, {
      updated: updatedResponse,
      original: originalResponse,
    });

    const context =
      await this.timelineReferenceService.resolveProjectContextByReference(
        updatedTimeline.reference,
        updatedTimeline.referenceId,
      );

    await this.publishTimelineAdjustedNotification(
      context.projectId,
      originalResponse,
      updatedResponse,
      user,
    );

    return updatedResponse;
  }

  async deleteTimeline(timelineId: string, user: JwtUser): Promise<void> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const auditUserId = this.getAuditUserIdBigInt(user);

    const existingTimeline =
      await this.findTimelineWithMilestones(parsedTimelineId);

    if (!existingTimeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${timelineId}.`,
      );
    }

    const deletedMilestones = await this.prisma.$transaction(async (tx) => {
      const milestones = await tx.milestone.findMany({
        where: {
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
        select: {
          id: true,
          timelineId: true,
        },
      });

      await tx.timeline.update({
        where: {
          id: parsedTimelineId,
        },
        data: {
          deletedAt: new Date(),
          deletedBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      await tx.milestone.updateMany({
        where: {
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          deletedBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      return milestones;
    });

    this.publishTimelineAction(KAFKA_TOPIC.TIMELINE_REMOVED, {
      id: timelineId,
    });

    for (const milestone of deletedMilestones) {
      this.publishMilestoneAction(KAFKA_TOPIC.MILESTONE_REMOVED, {
        id: milestone.id.toString(),
        timelineId: milestone.timelineId.toString(),
      });
    }
  }

  private async createTemplateMilestones(
    tx: Prisma.TransactionClient,
    timeline: Timeline,
    templateId: bigint,
    auditUserId: bigint,
    statusAuditUserId: number,
  ): Promise<Milestone[]> {
    const templates = await tx.milestoneTemplate.findMany({
      where: {
        reference: 'productTemplate',
        referenceId: templateId,
        deletedAt: null,
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    const createdMilestones: Milestone[] = [];
    let nextStartDate = new Date(timeline.startDate);

    for (const template of templates) {
      const milestone = await this.createMilestoneFromTemplate(
        tx,
        timeline,
        template,
        nextStartDate,
        auditUserId,
      );

      createdMilestones.push(milestone);

      await tx.statusHistory.create({
        data: {
          reference: 'milestone',
          referenceId: milestone.id,
          status: milestone.status,
          comment: null,
          createdBy: statusAuditUserId,
          updatedBy: statusAuditUserId,
        },
      });

      if (!template.hidden) {
        nextStartDate = this.addDaysUtc(
          milestone.endDate || milestone.startDate,
          1,
        );
      }
    }

    return createdMilestones;
  }

  private async createMilestoneFromTemplate(
    tx: Prisma.TransactionClient,
    timeline: Timeline,
    template: MilestoneTemplate,
    startDate: Date,
    auditUserId: bigint,
  ): Promise<Milestone> {
    const duration = Math.max(1, template.duration);
    const computedEndDate = this.addDaysUtc(startDate, duration - 1);

    return tx.milestone.create({
      data: {
        timelineId: timeline.id,
        name: template.name,
        description: template.description,
        duration,
        startDate,
        endDate: computedEndDate,
        status: ProjectStatus.reviewed,
        type: template.type,
        details: {
          metadata: template.metadata,
        } as Prisma.InputJsonValue,
        order: template.order,
        plannedText: template.plannedText,
        activeText: template.activeText,
        completedText: template.completedText,
        blockedText: template.blockedText,
        hidden: template.hidden,
        createdBy: auditUserId,
        updatedBy: auditUserId,
      },
    });
  }

  private async rescheduleMilestonesForTimeline(
    tx: Prisma.TransactionClient,
    timelineId: bigint,
    timelineStartDate: Date,
    auditUserId: bigint,
  ): Promise<void> {
    const milestones = await tx.milestone.findMany({
      where: {
        timelineId,
        deletedAt: null,
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    let nextStartDate = new Date(timelineStartDate);

    for (const milestone of milestones) {
      const duration = Math.max(1, milestone.duration);
      const expectedEndDate = this.addDaysUtc(nextStartDate, duration - 1);

      const shouldUpdate =
        milestone.startDate.getTime() !== nextStartDate.getTime() ||
        milestone.endDate?.getTime() !== expectedEndDate.getTime();

      if (shouldUpdate) {
        await tx.milestone.update({
          where: {
            id: milestone.id,
          },
          data: {
            startDate: nextStartDate,
            endDate: expectedEndDate,
            updatedBy: auditUserId,
          },
        });
      }

      nextStartDate = this.addDaysUtc(expectedEndDate, 1);
    }
  }

  private async findTimelineWithMilestones(
    timelineId: bigint,
  ): Promise<TimelineWithMilestones | null> {
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        id: timelineId,
        deletedAt: null,
      },
      include: this.getMilestoneInclude(),
    });

    return timeline as TimelineWithMilestones | null;
  }

  private getMilestoneInclude(): Prisma.TimelineInclude {
    return {
      milestones: {
        where: {
          deletedAt: null,
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: {
          statusHistory: {
            where: {
              reference: 'milestone',
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          },
        },
      },
    };
  }

  private toTimelineDto(timeline: TimelineWithMilestones): TimelineResponseDto {
    return {
      id: timeline.id.toString(),
      name: timeline.name,
      description: timeline.description,
      startDate: timeline.startDate,
      endDate: timeline.endDate,
      reference: timeline.reference,
      referenceId: timeline.referenceId.toString(),
      milestones: timeline.milestones.map((milestone) =>
        this.toMilestoneDto(milestone),
      ),
      createdAt: timeline.createdAt,
      updatedAt: timeline.updatedAt,
      createdBy: timeline.createdBy.toString(),
      updatedBy: timeline.updatedBy.toString(),
    };
  }

  private toMilestoneDto(
    milestone: MilestoneWithStatusHistory,
  ): MilestoneResponseDto {
    return {
      id: milestone.id.toString(),
      timelineId: milestone.timelineId.toString(),
      name: milestone.name,
      description: milestone.description,
      duration: milestone.duration,
      startDate: milestone.startDate,
      actualStartDate: milestone.actualStartDate,
      endDate: milestone.endDate,
      completionDate: milestone.completionDate,
      status: milestone.status,
      type: milestone.type,
      details:
        (toSerializable(milestone.details) as Record<string, unknown> | null) ||
        null,
      order: milestone.order,
      plannedText: milestone.plannedText,
      activeText: milestone.activeText,
      completedText: milestone.completedText,
      blockedText: milestone.blockedText,
      hidden: milestone.hidden,
      statusHistory: (milestone.statusHistory || []).map((entry) =>
        this.toStatusHistoryDto(entry),
      ),
      createdAt: milestone.createdAt,
      updatedAt: milestone.updatedAt,
      createdBy: milestone.createdBy.toString(),
      updatedBy: milestone.updatedBy.toString(),
    };
  }

  private toStatusHistoryDto(
    statusHistory: StatusHistory,
  ): StatusHistoryResponseDto {
    return {
      id: statusHistory.id.toString(),
      reference: statusHistory.reference,
      referenceId: statusHistory.referenceId.toString(),
      status: statusHistory.status,
      comment: statusHistory.comment,
      createdBy: statusHistory.createdBy,
      createdAt: statusHistory.createdAt,
      updatedBy: statusHistory.updatedBy,
      updatedAt: statusHistory.updatedAt,
    };
  }

  private validateTimelineDateRange(
    startDate: Date,
    endDate?: Date | null,
  ): void {
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('Timeline endDate must be >= startDate.');
    }
  }

  private addDaysUtc(date: Date, days: number): Date {
    const value = new Date(date);
    value.setUTCDate(value.getUTCDate() + days);
    return value;
  }

  private parseId(value: string, fieldName: string): bigint {
    try {
      const parsed = BigInt(value);
      if (parsed <= BigInt(0)) {
        throw new Error('invalid');
      }
      return parsed;
    } catch {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }
  }

  private getAuditUserIdBigInt(user: JwtUser): bigint {
    const rawUserId = String(user.userId || '').trim();
    if (!/^\d+$/.test(rawUserId)) {
      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    return BigInt(rawUserId);
  }

  private getAuditUserIdInt(user: JwtUser): number {
    const rawUserId = String(user.userId || '').trim();
    if (!/^\d+$/.test(rawUserId)) {
      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    const parsed = Number.parseInt(rawUserId, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    return parsed;
  }

  private publishTimelineAction(topic: string, payload: unknown): void {
    void publishTimelineEvent(topic, toSerializable(payload));
  }

  private publishMilestoneAction(topic: string, payload: unknown): void {
    void publishMilestoneEvent(topic, toSerializable(payload));
  }

  private async publishTimelineAdjustedNotification(
    projectId: bigint,
    originalTimeline: TimelineResponseDto,
    updatedTimeline: TimelineResponseDto,
    user: JwtUser,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        details: true,
      },
    });

    if (!project) {
      this.logger.warn(
        `Skipping timeline adjustment notification. Project ${projectId.toString()} was not found.`,
      );
      return;
    }

    const userId = this.getNotificationUserId(user);

    const details =
      project.details &&
      typeof project.details === 'object' &&
      !Array.isArray(project.details)
        ? (project.details as Record<string, unknown>)
        : {};
    const utm =
      details.utm &&
      typeof details.utm === 'object' &&
      !Array.isArray(details.utm)
        ? (details.utm as Record<string, unknown>)
        : {};

    const payload = {
      projectId: project.id.toString(),
      projectName: project.name,
      refCode: typeof utm.code === 'string' ? utm.code : undefined,
      projectUrl: this.buildProjectUrl(project.id),
      originalTimeline: toSerializable(originalTimeline),
      updatedTimeline: toSerializable(updatedTimeline),
      userId,
      initiatorUserId: userId,
    };

    await publishNotificationEvent(KAFKA_TOPIC.TIMELINE_ADJUSTED, payload);
  }

  private buildProjectUrl(projectId: bigint): string {
    const baseUrl =
      process.env.WORK_MANAGER_URL ||
      process.env.WORK_MANAGER_APP_URL ||
      'https://platform.topcoder.com/connect/';

    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}projects/${projectId.toString()}`;
  }

  private getNotificationUserId(user: JwtUser): string {
    const rawUserId = String(user.userId || '').trim();

    if (/^\d+$/.test(rawUserId)) {
      return rawUserId;
    }

    return '-1';
  }
}
