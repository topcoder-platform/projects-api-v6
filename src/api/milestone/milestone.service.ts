import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Milestone,
  Prisma,
  Project,
  ProjectStatus,
  StatusHistory,
  Timeline,
} from '@prisma/client';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  publishMilestoneEvent,
  publishNotificationEvent,
} from 'src/shared/utils/event.utils';
import { toSerializable } from '../metadata/utils/metadata-utils';
import { TimelineReferenceService } from '../timeline/timeline-reference.service';
import { BulkUpdateMilestoneDto } from './dto/bulk-update-milestone.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { MilestoneListQueryDto } from './dto/milestone-list-query.dto';
import { MilestoneResponseDto } from './dto/milestone-response.dto';
import { StatusHistoryResponseDto } from './dto/status-history-response.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

type MilestoneWithStatusHistory = Milestone & {
  statusHistory?: StatusHistory[];
};

interface MilestoneUpdateResult {
  original: MilestoneResponseDto;
  updated: MilestoneResponseDto;
}

@Injectable()
export class MilestoneService {
  private readonly logger = LoggerService.forRoot('MilestoneService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineReferenceService: TimelineReferenceService,
  ) {}

  async listMilestones(
    timelineId: string,
    query: MilestoneListQueryDto,
  ): Promise<MilestoneResponseDto[]> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');

    await this.getTimelineOrFail(parsedTimelineId);

    const sort = query.sort || 'order asc';

    const milestones = await this.prisma.milestone.findMany({
      where: {
        timelineId: parsedTimelineId,
        deletedAt: null,
      },
      include: this.statusHistoryInclude(),
      orderBy: this.toOrderBy(sort),
    });

    return milestones.map((milestone) =>
      this.toMilestoneDto(milestone as MilestoneWithStatusHistory),
    );
  }

  async getMilestone(
    timelineId: string,
    milestoneId: string,
  ): Promise<MilestoneResponseDto> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const parsedMilestoneId = this.parseId(milestoneId, 'milestoneId');

    const milestone = await this.prisma.milestone.findFirst({
      where: {
        id: parsedMilestoneId,
        timelineId: parsedTimelineId,
        deletedAt: null,
      },
      include: this.statusHistoryInclude(),
    });

    if (!milestone) {
      throw new NotFoundException(
        `Milestone not found for milestone id ${milestoneId}.`,
      );
    }

    return this.toMilestoneDto(milestone as MilestoneWithStatusHistory);
  }

  async createMilestone(
    timelineId: string,
    dto: CreateMilestoneDto,
    user: JwtUser,
  ): Promise<MilestoneResponseDto> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const auditUserId = this.getAuditUserIdBigInt(user);
    const statusAuditUserId = this.getAuditUserIdInt(user);

    const timeline = await this.getTimelineOrFail(parsedTimelineId);

    const [createdMilestone, context] = await this.prisma.$transaction(
      async (tx) => {
        const milestoneCount = await tx.milestone.count({
          where: {
            timelineId: parsedTimelineId,
            deletedAt: null,
          },
        });

        const order = this.resolveRequestedOrder(dto.order, milestoneCount + 1);

        await tx.milestone.updateMany({
          where: {
            timelineId: parsedTimelineId,
            deletedAt: null,
            order: {
              gte: order,
            },
          },
          data: {
            order: {
              increment: 1,
            },
            updatedBy: auditUserId,
          },
        });

        this.validateMilestoneDates(dto.startDate, dto.endDate ?? null);
        this.validateMilestoneCompletionDates(
          dto.actualStartDate ?? null,
          dto.completionDate ?? null,
        );

        const endDate =
          dto.endDate || this.addDaysUtc(dto.startDate, dto.duration - 1);

        const created = await tx.milestone.create({
          data: {
            timelineId: parsedTimelineId,
            name: dto.name,
            description: dto.description || null,
            duration: dto.duration,
            startDate: dto.startDate,
            actualStartDate: dto.actualStartDate || null,
            endDate,
            completionDate: dto.completionDate || null,
            status: dto.status,
            type: dto.type,
            details: this.toJsonInput(dto.details || {}),
            order,
            plannedText: dto.plannedText || null,
            activeText: dto.activeText || null,
            completedText: dto.completedText || null,
            blockedText: dto.blockedText || null,
            hidden: Boolean(dto.hidden),
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });

        await tx.statusHistory.create({
          data: {
            reference: 'milestone',
            referenceId: created.id,
            status: created.status,
            comment: null,
            createdBy: statusAuditUserId,
            updatedBy: statusAuditUserId,
          },
        });

        const contextByTimeline =
          await this.timelineReferenceService.resolveProjectContextByTimelineId(
            parsedTimelineId,
          );

        return [created, contextByTimeline] as const;
      },
    );

    const createdWithHistory = await this.prisma.milestone.findFirst({
      where: {
        id: createdMilestone.id,
        timelineId: parsedTimelineId,
        deletedAt: null,
      },
      include: this.statusHistoryInclude(),
    });

    if (!createdWithHistory) {
      throw new NotFoundException(
        `Milestone not found for milestone id ${createdMilestone.id.toString()} after creation.`,
      );
    }

    const response = this.toMilestoneDto(
      createdWithHistory as MilestoneWithStatusHistory,
    );

    this.publishMilestoneAction(KAFKA_TOPIC.MILESTONE_ADDED, response);

    await this.publishMilestoneAddedNotification(
      context.projectId,
      response,
      user,
      timeline,
    );

    return response;
  }

  async updateMilestone(
    timelineId: string,
    milestoneId: string,
    dto: UpdateMilestoneDto,
    user: JwtUser,
  ): Promise<MilestoneResponseDto> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const parsedMilestoneId = this.parseId(milestoneId, 'milestoneId');
    const auditUserId = this.getAuditUserIdBigInt(user);
    const statusAuditUserId = this.getAuditUserIdInt(user);

    const timeline = await this.getTimelineOrFail(parsedTimelineId);

    const { original, updated } = await this.prisma.$transaction(async (tx) => {
      const existingMilestone = await tx.milestone.findFirst({
        where: {
          id: parsedMilestoneId,
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
      });

      if (!existingMilestone) {
        throw new NotFoundException(
          `Milestone not found for milestone id ${milestoneId}.`,
        );
      }

      const totalMilestones = await tx.milestone.count({
        where: {
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
      });

      const resolvedOrder = this.resolveRequestedOrder(
        dto.order,
        totalMilestones,
        existingMilestone.order,
      );

      if (resolvedOrder < existingMilestone.order) {
        await tx.milestone.updateMany({
          where: {
            timelineId: parsedTimelineId,
            deletedAt: null,
            id: {
              not: parsedMilestoneId,
            },
            order: {
              gte: resolvedOrder,
              lt: existingMilestone.order,
            },
          },
          data: {
            order: {
              increment: 1,
            },
            updatedBy: auditUserId,
          },
        });
      }

      if (resolvedOrder > existingMilestone.order) {
        await tx.milestone.updateMany({
          where: {
            timelineId: parsedTimelineId,
            deletedAt: null,
            id: {
              not: parsedMilestoneId,
            },
            order: {
              lte: resolvedOrder,
              gt: existingMilestone.order,
            },
          },
          data: {
            order: {
              decrement: 1,
            },
            updatedBy: auditUserId,
          },
        });
      }

      const original = existingMilestone;

      const startDate = dto.startDate || original.startDate;
      const duration =
        typeof dto.duration === 'number' ? dto.duration : original.duration;
      const endDate =
        typeof dto.endDate !== 'undefined'
          ? dto.endDate
          : original.endDate || this.addDaysUtc(startDate, duration - 1);
      const actualStartDate =
        typeof dto.actualStartDate !== 'undefined'
          ? dto.actualStartDate
          : original.actualStartDate;
      const completionDate =
        typeof dto.completionDate !== 'undefined'
          ? dto.completionDate
          : original.completionDate;

      this.validateMilestoneDates(startDate, endDate);
      this.validateMilestoneCompletionDates(actualStartDate, completionDate);

      const mergedDetails =
        typeof dto.details === 'undefined'
          ? original.details
          : this.mergeDetails(original.details, dto.details);

      const updatedMilestone = await tx.milestone.update({
        where: {
          id: parsedMilestoneId,
        },
        data: {
          ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
          ...(typeof dto.description === 'undefined'
            ? {}
            : { description: dto.description }),
          ...(typeof dto.duration === 'undefined'
            ? {}
            : { duration: dto.duration }),
          ...(typeof dto.startDate === 'undefined' ? {} : { startDate }),
          ...(typeof dto.actualStartDate === 'undefined'
            ? {}
            : { actualStartDate }),
          ...(typeof dto.endDate === 'undefined' ? {} : { endDate }),
          ...(typeof dto.completionDate === 'undefined'
            ? {}
            : { completionDate }),
          ...(typeof dto.status === 'undefined' ? {} : { status: dto.status }),
          ...(typeof dto.type === 'undefined' ? {} : { type: dto.type }),
          ...(typeof dto.details === 'undefined'
            ? {}
            : { details: this.toJsonInput(mergedDetails) }),
          order: resolvedOrder,
          ...(typeof dto.plannedText === 'undefined'
            ? {}
            : { plannedText: dto.plannedText }),
          ...(typeof dto.activeText === 'undefined'
            ? {}
            : { activeText: dto.activeText }),
          ...(typeof dto.completedText === 'undefined'
            ? {}
            : { completedText: dto.completedText }),
          ...(typeof dto.blockedText === 'undefined'
            ? {}
            : { blockedText: dto.blockedText }),
          ...(typeof dto.hidden === 'undefined' ? {} : { hidden: dto.hidden }),
          updatedBy: auditUserId,
        },
      });

      if (original.status !== updatedMilestone.status) {
        await tx.statusHistory.create({
          data: {
            reference: 'milestone',
            referenceId: updatedMilestone.id,
            status: updatedMilestone.status,
            comment: dto.statusComment || null,
            createdBy: statusAuditUserId,
            updatedBy: statusAuditUserId,
          },
        });
      }

      const [originalWithHistory, updatedWithHistory] = await Promise.all([
        tx.milestone.findFirst({
          where: {
            id: original.id,
          },
          include: this.statusHistoryInclude(),
        }),
        tx.milestone.findFirst({
          where: {
            id: updatedMilestone.id,
          },
          include: this.statusHistoryInclude(),
        }),
      ]);

      if (!originalWithHistory || !updatedWithHistory) {
        throw new NotFoundException(
          `Milestone not found for milestone id ${milestoneId} after update.`,
        );
      }

      return {
        original: this.toMilestoneDto(
          originalWithHistory as MilestoneWithStatusHistory,
        ),
        updated: this.toMilestoneDto(
          updatedWithHistory as MilestoneWithStatusHistory,
        ),
      };
    });

    this.publishMilestoneAction(KAFKA_TOPIC.MILESTONE_UPDATED, {
      original,
      updated,
    });

    const context =
      await this.timelineReferenceService.resolveProjectContextByTimelineId(
        parsedTimelineId,
      );

    await this.publishMilestoneUpdatedNotifications(
      context.projectId,
      original,
      updated,
      user,
      timeline,
    );

    return updated;
  }

  async bulkUpdateMilestones(
    timelineId: string,
    updates: BulkUpdateMilestoneDto[],
    user: JwtUser,
  ): Promise<MilestoneResponseDto[]> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const auditUserId = this.getAuditUserIdBigInt(user);
    const statusAuditUserId = this.getAuditUserIdInt(user);

    const timeline = await this.getTimelineOrFail(parsedTimelineId);

    const operationResult = await this.prisma.$transaction(async (tx) => {
      const existingMilestones = await tx.milestone.findMany({
        where: {
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
        include: this.statusHistoryInclude(),
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });

      const existingById = new Map<string, MilestoneWithStatusHistory>(
        existingMilestones.map((milestone) => [
          milestone.id.toString(),
          milestone as MilestoneWithStatusHistory,
        ]),
      );

      const keepIds = new Set<string>();
      for (const update of updates) {
        if (typeof update.id === 'number') {
          keepIds.add(String(update.id));
        }
      }

      for (const id of keepIds) {
        if (!existingById.has(id)) {
          throw new NotFoundException(
            `Milestone not found for milestone id ${id}.`,
          );
        }
      }

      const toDelete = existingMilestones.filter(
        (milestone) => !keepIds.has(milestone.id.toString()),
      );

      if (toDelete.length > 0) {
        await tx.milestone.updateMany({
          where: {
            id: {
              in: toDelete.map((milestone) => milestone.id),
            },
          },
          data: {
            deletedAt: new Date(),
            deletedBy: auditUserId,
            updatedBy: auditUserId,
          },
        });
      }

      const createdIds: bigint[] = [];
      const updatedRecords: MilestoneUpdateResult[] = [];

      const maxExistingOrder = existingMilestones.reduce(
        (maxOrder, milestone) => Math.max(maxOrder, milestone.order),
        0,
      );
      let nextOrder = Math.max(maxExistingOrder, updates.length) + 1;

      for (const update of updates) {
        if (typeof update.id === 'number') {
          const milestone = existingById.get(String(update.id));
          if (!milestone) {
            throw new NotFoundException(
              `Milestone not found for milestone id ${update.id}.`,
            );
          }

          const startDate = update.startDate || milestone.startDate;
          const duration =
            typeof update.duration === 'number'
              ? update.duration
              : milestone.duration;
          const endDate =
            typeof update.endDate !== 'undefined'
              ? update.endDate
              : milestone.endDate || this.addDaysUtc(startDate, duration - 1);
          const actualStartDate =
            typeof update.actualStartDate !== 'undefined'
              ? update.actualStartDate
              : milestone.actualStartDate;
          const completionDate =
            typeof update.completionDate !== 'undefined'
              ? update.completionDate
              : milestone.completionDate;

          this.validateMilestoneDates(startDate, endDate);
          this.validateMilestoneCompletionDates(
            actualStartDate,
            completionDate,
          );

          const mergedDetails =
            typeof update.details === 'undefined'
              ? milestone.details
              : this.mergeDetails(milestone.details, update.details);

          const updatedMilestone = await tx.milestone.update({
            where: {
              id: milestone.id,
            },
            data: {
              ...(typeof update.name === 'undefined'
                ? {}
                : { name: update.name }),
              ...(typeof update.description === 'undefined'
                ? {}
                : { description: update.description }),
              ...(typeof update.duration === 'undefined'
                ? {}
                : { duration: update.duration }),
              ...(typeof update.startDate === 'undefined' ? {} : { startDate }),
              ...(typeof update.actualStartDate === 'undefined'
                ? {}
                : { actualStartDate }),
              ...(typeof update.endDate === 'undefined' ? {} : { endDate }),
              ...(typeof update.completionDate === 'undefined'
                ? {}
                : { completionDate }),
              ...(typeof update.status === 'undefined'
                ? {}
                : { status: update.status }),
              ...(typeof update.type === 'undefined'
                ? {}
                : { type: update.type }),
              ...(typeof update.details === 'undefined'
                ? {}
                : { details: this.toJsonInput(mergedDetails) }),
              ...(typeof update.order === 'undefined'
                ? {}
                : { order: update.order }),
              ...(typeof update.plannedText === 'undefined'
                ? {}
                : { plannedText: update.plannedText }),
              ...(typeof update.activeText === 'undefined'
                ? {}
                : { activeText: update.activeText }),
              ...(typeof update.completedText === 'undefined'
                ? {}
                : { completedText: update.completedText }),
              ...(typeof update.blockedText === 'undefined'
                ? {}
                : { blockedText: update.blockedText }),
              ...(typeof update.hidden === 'undefined'
                ? {}
                : { hidden: update.hidden }),
              updatedBy: auditUserId,
            },
          });

          if (milestone.status !== updatedMilestone.status) {
            await tx.statusHistory.create({
              data: {
                reference: 'milestone',
                referenceId: updatedMilestone.id,
                status: updatedMilestone.status,
                comment: update.statusComment || null,
                createdBy: statusAuditUserId,
                updatedBy: statusAuditUserId,
              },
            });
          }

          const updatedWithHistory = await tx.milestone.findFirst({
            where: {
              id: updatedMilestone.id,
            },
            include: this.statusHistoryInclude(),
          });

          if (!updatedWithHistory) {
            throw new NotFoundException(
              `Milestone not found for milestone id ${updatedMilestone.id.toString()} after update.`,
            );
          }

          updatedRecords.push({
            original: this.toMilestoneDto(milestone),
            updated: this.toMilestoneDto(
              updatedWithHistory as MilestoneWithStatusHistory,
            ),
          });

          continue;
        }

        const createOrder = update.order || nextOrder;
        nextOrder += 1;

        const startDate = update.startDate || timeline.startDate;
        const duration = update.duration || 1;
        const endDate =
          update.endDate || this.addDaysUtc(startDate, duration - 1);

        this.validateMilestoneDates(startDate, endDate);
        this.validateMilestoneCompletionDates(
          update.actualStartDate || null,
          update.completionDate || null,
        );

        const createdMilestone = await tx.milestone.create({
          data: {
            timelineId: parsedTimelineId,
            name: update.name || 'Milestone',
            description: update.description || null,
            duration,
            startDate,
            actualStartDate: update.actualStartDate || null,
            endDate,
            completionDate: update.completionDate || null,
            status: update.status || ProjectStatus.draft,
            type: update.type || 'generic',
            details: this.toJsonInput(update.details || {}),
            order: createOrder,
            plannedText: update.plannedText || null,
            activeText: update.activeText || null,
            completedText: update.completedText || null,
            blockedText: update.blockedText || null,
            hidden: Boolean(update.hidden),
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });

        await tx.statusHistory.create({
          data: {
            reference: 'milestone',
            referenceId: createdMilestone.id,
            status: createdMilestone.status,
            comment: null,
            createdBy: statusAuditUserId,
            updatedBy: statusAuditUserId,
          },
        });

        createdIds.push(createdMilestone.id);
      }

      await this.reindexMilestoneOrders(tx, parsedTimelineId, auditUserId);

      const milestones = await tx.milestone.findMany({
        where: {
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
        include: this.statusHistoryInclude(),
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });

      const milestonesById = new Map(
        milestones.map((milestone) => [milestone.id.toString(), milestone]),
      );
      const createdMilestones = createdIds
        .map((id) => milestonesById.get(id.toString()))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      return {
        created: createdMilestones.map((entry) =>
          this.toMilestoneDto(entry as unknown as MilestoneWithStatusHistory),
        ),
        updated: updatedRecords.map((entry) => ({
          original: entry.original,
          updated: milestonesById.get(entry.updated.id)
            ? this.toMilestoneDto(
                milestonesById.get(
                  entry.updated.id,
                ) as unknown as MilestoneWithStatusHistory,
              )
            : entry.updated,
        })),
        deleted: toDelete.map((milestone) => ({
          id: milestone.id.toString(),
          timelineId: parsedTimelineId.toString(),
        })),
        milestones: milestones.map((milestone) =>
          this.toMilestoneDto(milestone as MilestoneWithStatusHistory),
        ),
      };
    });

    for (const created of operationResult.created) {
      this.publishMilestoneAction(KAFKA_TOPIC.MILESTONE_ADDED, created);
    }

    for (const deleted of operationResult.deleted) {
      this.publishMilestoneAction(KAFKA_TOPIC.MILESTONE_REMOVED, deleted);
    }

    for (const updated of operationResult.updated) {
      this.publishMilestoneAction(KAFKA_TOPIC.MILESTONE_UPDATED, updated);
    }

    const context =
      await this.timelineReferenceService.resolveProjectContextByTimelineId(
        parsedTimelineId,
      );

    for (const created of operationResult.created) {
      await this.publishMilestoneAddedNotification(
        context.projectId,
        created,
        user,
        timeline,
      );
    }

    for (const deleted of operationResult.deleted) {
      await this.publishMilestoneRemovedNotification(
        context.projectId,
        deleted,
        user,
        timeline,
      );
    }

    for (const updated of operationResult.updated) {
      await this.publishMilestoneUpdatedNotifications(
        context.projectId,
        updated.original,
        updated.updated,
        user,
        timeline,
      );
    }

    return operationResult.milestones;
  }

  async deleteMilestone(
    timelineId: string,
    milestoneId: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedTimelineId = this.parseId(timelineId, 'timelineId');
    const parsedMilestoneId = this.parseId(milestoneId, 'milestoneId');
    const auditUserId = this.getAuditUserIdBigInt(user);

    const timeline = await this.getTimelineOrFail(parsedTimelineId);

    const deletedMilestone = await this.prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.findFirst({
        where: {
          id: parsedMilestoneId,
          timelineId: parsedTimelineId,
          deletedAt: null,
        },
      });

      if (!milestone) {
        throw new NotFoundException(
          `Milestone not found for milestone id ${milestoneId}.`,
        );
      }

      await tx.milestone.update({
        where: {
          id: parsedMilestoneId,
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
          order: {
            gt: milestone.order,
          },
        },
        data: {
          order: {
            decrement: 1,
          },
          updatedBy: auditUserId,
        },
      });

      return {
        id: milestone.id.toString(),
        timelineId: milestone.timelineId.toString(),
      };
    });

    this.publishMilestoneAction(
      KAFKA_TOPIC.MILESTONE_REMOVED,
      deletedMilestone,
    );

    const context =
      await this.timelineReferenceService.resolveProjectContextByTimelineId(
        parsedTimelineId,
      );

    await this.publishMilestoneRemovedNotification(
      context.projectId,
      deletedMilestone,
      user,
      timeline,
    );
  }

  private async getTimelineOrFail(timelineId: bigint): Promise<Timeline> {
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        id: timelineId,
        deletedAt: null,
      },
    });

    if (!timeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${timelineId.toString()}.`,
      );
    }

    return timeline;
  }

  private statusHistoryInclude(): Prisma.MilestoneInclude {
    return {
      statusHistory: {
        where: {
          reference: 'milestone',
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      },
    };
  }

  private toOrderBy(
    sort: string,
  ):
    | Prisma.MilestoneOrderByWithRelationInput
    | Prisma.MilestoneOrderByWithRelationInput[] {
    const normalized = sort.trim().toLowerCase();

    if (normalized === 'order desc') {
      return [{ order: 'desc' }, { id: 'desc' }];
    }

    return [{ order: 'asc' }, { id: 'asc' }];
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

  private toStatusHistoryDto(entry: StatusHistory): StatusHistoryResponseDto {
    return {
      id: entry.id.toString(),
      reference: entry.reference,
      referenceId: entry.referenceId.toString(),
      status: entry.status,
      comment: entry.comment,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
      updatedBy: entry.updatedBy,
      updatedAt: entry.updatedAt,
    };
  }

  private resolveRequestedOrder(
    requested: number | undefined,
    maxOrder: number,
    fallback?: number,
  ): number {
    if (typeof requested === 'undefined') {
      if (typeof fallback === 'number') {
        return fallback;
      }

      return maxOrder;
    }

    if (!Number.isInteger(requested) || requested < 1) {
      throw new BadRequestException('order must be a positive integer.');
    }

    if (requested > maxOrder) {
      return maxOrder;
    }

    return requested;
  }

  private async reindexMilestoneOrders(
    tx: Prisma.TransactionClient,
    timelineId: bigint,
    auditUserId: bigint,
  ): Promise<void> {
    const milestones = await tx.milestone.findMany({
      where: {
        timelineId,
        deletedAt: null,
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        order: true,
      },
    });

    for (let index = 0; index < milestones.length; index += 1) {
      const expectedOrder = index + 1;

      if (milestones[index].order !== expectedOrder) {
        await tx.milestone.update({
          where: {
            id: milestones[index].id,
          },
          data: {
            order: expectedOrder,
            updatedBy: auditUserId,
          },
        });
      }
    }
  }

  private validateMilestoneDates(startDate: Date, endDate?: Date | null): void {
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('Milestone endDate must be >= startDate.');
    }
  }

  private validateMilestoneCompletionDates(
    actualStartDate?: Date | null,
    completionDate?: Date | null,
  ): void {
    if (
      actualStartDate &&
      completionDate &&
      completionDate.getTime() < actualStartDate.getTime()
    ) {
      throw new BadRequestException(
        'The milestone completionDate should be greater or equal to actualStartDate.',
      );
    }
  }

  private mergeDetails(
    existing: Prisma.JsonValue | null,
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const existingObject =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};

    return {
      ...existingObject,
      ...incoming,
    };
  }

  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
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

  private publishMilestoneAction(topic: string, payload: unknown): void {
    void publishMilestoneEvent(topic, toSerializable(payload));
  }

  private async publishMilestoneAddedNotification(
    projectId: bigint,
    createdMilestone: MilestoneResponseDto,
    user: JwtUser,
    timeline: Timeline,
  ): Promise<void> {
    const project = await this.getProjectForNotifications(projectId);
    if (!project) {
      return;
    }

    const timelinePayload =
      await this.buildTimelineWithProgressNotificationPayload(timeline);

    await publishNotificationEvent(KAFKA_TOPIC.MILESTONE_NOTIFICATION_ADDED, {
      ...this.buildNotificationBasePayload(project, user),
      timeline: timelinePayload,
      addedMilestone: toSerializable(createdMilestone),
    });

    await publishNotificationEvent(KAFKA_TOPIC.TIMELINE_ADJUSTED, {
      ...this.buildNotificationBasePayload(project, user),
      originalTimeline: this.buildTimelineNotificationPayload(timeline),
      updatedTimeline: timelinePayload,
    });
  }

  private async publishMilestoneRemovedNotification(
    projectId: bigint,
    removedMilestone: { id: string; timelineId: string },
    user: JwtUser,
    timeline?: Timeline,
  ): Promise<void> {
    const project = await this.getProjectForNotifications(projectId);
    if (!project) {
      return;
    }

    await publishNotificationEvent(KAFKA_TOPIC.MILESTONE_NOTIFICATION_REMOVED, {
      ...this.buildNotificationBasePayload(project, user),
      removedMilestone,
    });

    if (timeline) {
      await publishNotificationEvent(KAFKA_TOPIC.TIMELINE_ADJUSTED, {
        ...this.buildNotificationBasePayload(project, user),
        originalTimeline: this.buildTimelineNotificationPayload(timeline),
        updatedTimeline:
          await this.buildTimelineWithProgressNotificationPayload(timeline),
      });
    }
  }

  private async publishMilestoneUpdatedNotifications(
    projectId: bigint,
    original: MilestoneResponseDto,
    updated: MilestoneResponseDto,
    user: JwtUser,
    timeline: Timeline,
  ): Promise<void> {
    const project = await this.getProjectForNotifications(projectId);
    if (!project) {
      return;
    }

    const timelinePayload =
      await this.buildTimelineWithProgressNotificationPayload(timeline);

    const commonPayload = {
      ...this.buildNotificationBasePayload(project, user),
      timeline: timelinePayload,
      originalMilestone: toSerializable(original),
      updatedMilestone: toSerializable(updated),
    };

    await publishNotificationEvent(
      KAFKA_TOPIC.MILESTONE_NOTIFICATION_UPDATED,
      commonPayload,
    );

    const statusTransitionTopic = this.detectMilestoneStatusTransition(
      original,
      updated,
    );

    if (statusTransitionTopic) {
      await publishNotificationEvent(statusTransitionTopic, commonPayload);
    }

    const originalWaiting = this.getWaitingForCustomerFlag(original.details);
    const updatedWaiting = this.getWaitingForCustomerFlag(updated.details);

    if (!originalWaiting && updatedWaiting) {
      await publishNotificationEvent(
        KAFKA_TOPIC.MILESTONE_WAITING_CUSTOMER,
        commonPayload,
      );
    }

    if (
      original.duration !== updated.duration ||
      original.order !== updated.order ||
      original.startDate.getTime() !== updated.startDate.getTime() ||
      original.endDate?.getTime() !== updated.endDate?.getTime()
    ) {
      await publishNotificationEvent(KAFKA_TOPIC.TIMELINE_ADJUSTED, {
        ...this.buildNotificationBasePayload(project, user),
        originalTimeline: this.buildTimelineNotificationPayload(timeline),
        updatedTimeline: timelinePayload,
      });
    }
  }

  private detectMilestoneStatusTransition(
    original: MilestoneResponseDto,
    updated: MilestoneResponseDto,
  ): string | undefined {
    if (original.status === updated.status) {
      return undefined;
    }

    if (updated.status === ProjectStatus.active) {
      return KAFKA_TOPIC.MILESTONE_TRANSITION_ACTIVE;
    }

    if (updated.status === ProjectStatus.completed) {
      return KAFKA_TOPIC.MILESTONE_TRANSITION_COMPLETED;
    }

    if (updated.status === ProjectStatus.paused) {
      return KAFKA_TOPIC.MILESTONE_TRANSITION_PAUSED;
    }

    return undefined;
  }

  private async getProjectForNotifications(
    projectId: bigint,
  ): Promise<Pick<Project, 'id' | 'name' | 'details'> | null> {
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
        `Skipping milestone notification because project ${projectId.toString()} was not found.`,
      );
      return null;
    }

    return project;
  }

  private buildNotificationBasePayload(
    project: Pick<Project, 'id' | 'name' | 'details'>,
    user: JwtUser,
  ): Record<string, unknown> {
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

    return {
      projectId: project.id.toString(),
      projectName: project.name,
      refCode: typeof utm.code === 'string' ? utm.code : undefined,
      projectUrl: this.buildProjectUrl(project.id),
      userId: this.getNotificationUserId(user),
      initiatorUserId: this.getNotificationUserId(user),
    };
  }

  private buildProjectUrl(projectId: bigint): string {
    const baseUrl =
      process.env.WORK_MANAGER_URL ||
      process.env.WORK_MANAGER_APP_URL ||
      'https://platform.topcoder.com/connect/';

    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${normalizedBase}projects/${projectId.toString()}`;
  }

  private buildTimelineNotificationPayload(
    timeline: Timeline,
  ): Record<string, unknown> {
    return {
      id: timeline.id.toString(),
      name: timeline.name,
      description: timeline.description,
      startDate: timeline.startDate,
      endDate: timeline.endDate,
      reference: timeline.reference,
      referenceId: timeline.referenceId.toString(),
    };
  }

  private async buildTimelineWithProgressNotificationPayload(
    timeline: Timeline,
  ): Promise<Record<string, unknown>> {
    const milestones = await this.prisma.milestone.findMany({
      where: {
        timelineId: timeline.id,
        deletedAt: null,
        hidden: false,
      },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: {
        duration: true,
        startDate: true,
        endDate: true,
        actualStartDate: true,
        completionDate: true,
      },
    });

    let duration = 0;
    let progress = 0;

    if (milestones.length > 0) {
      const first = milestones[0];
      const last = milestones[milestones.length - 1];
      const durationStartDate = first.actualStartDate || first.startDate;
      const durationEndDate =
        last.completionDate || last.endDate || last.startDate;

      duration =
        Math.max(
          0,
          Math.floor(
            (durationEndDate.getTime() - durationStartDate.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        ) + 1;

      let scheduledDuration = 0;
      let completedDuration = 0;

      for (const milestone of milestones) {
        if (milestone.completionDate) {
          const completedStartDate =
            milestone.actualStartDate || milestone.startDate;
          const completedValue =
            Math.max(
              0,
              Math.floor(
                (milestone.completionDate.getTime() -
                  completedStartDate.getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            ) + 1;

          scheduledDuration += completedValue;
          completedDuration += completedValue;
        } else {
          scheduledDuration += milestone.duration;
        }
      }

      if (scheduledDuration > 0) {
        progress = Math.round((completedDuration / scheduledDuration) * 100);
      }
    }

    return {
      ...this.buildTimelineNotificationPayload(timeline),
      duration,
      progress,
    };
  }

  private getWaitingForCustomerFlag(
    details: Record<string, unknown> | null | undefined,
  ): boolean {
    if (!details || typeof details !== 'object') {
      return false;
    }

    const metadata = details.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    const waitingForCustomer = (metadata as Record<string, unknown>)
      .waitingForCustomer;

    return waitingForCustomer === true;
  }

  private getNotificationUserId(user: JwtUser): string {
    const rawUserId = String(user.userId || '').trim();

    if (/^\d+$/.test(rawUserId)) {
      return rawUserId;
    }

    return '-1';
  }
}
