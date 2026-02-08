import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkStream } from '@prisma/client';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  publishNotificationEvent,
  publishWorkstreamEvent,
} from 'src/shared/utils/event.utils';
import {
  CreateWorkStreamDto,
  UpdateWorkStreamDto,
  WorkStreamListCriteria,
  WorkStreamResponseDto,
} from './workstream.dto';

type WorkStreamWithRelations = WorkStream & {
  phaseWorkStreams?: Array<{
    phase: {
      id: bigint;
      name: string | null;
      status: string | null;
      deletedAt: Date | null;
    } | null;
  }>;
};

const WORK_STREAM_SORT_FIELDS = ['name', 'status', 'createdAt', 'updatedAt'];

@Injectable()
export class WorkStreamService {
  private readonly logger = LoggerService.forRoot('WorkStreamService');

  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    dto: CreateWorkStreamDto,
    userId: string | number | undefined,
  ): Promise<WorkStreamResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    await this.ensureProjectExists(parsedProjectId);
    const auditUserId = this.getAuditUserId(userId);

    const created = await this.prisma.workStream.create({
      data: {
        projectId: parsedProjectId,
        name: dto.name,
        type: dto.type,
        status: dto.status,
        createdBy: auditUserId,
        updatedBy: auditUserId,
      },
    });

    const response = this.toDto(created);
    this.publishWorkstreamResourceEvent(
      KAFKA_TOPIC.PROJECT_WORKSTREAM_ADDED,
      response,
    );

    if (response.status === 'active') {
      this.publishNotification(KAFKA_TOPIC.PROJECT_WORK_TRANSITION_ACTIVE, {
        projectId,
        workstream: response,
        userId: this.getNotificationUserId(userId),
        initiatorUserId: this.getNotificationUserId(userId),
      });
    }

    if (response.status === 'completed') {
      this.publishNotification(KAFKA_TOPIC.PROJECT_WORK_TRANSITION_COMPLETED, {
        projectId,
        workstream: response,
        userId: this.getNotificationUserId(userId),
        initiatorUserId: this.getNotificationUserId(userId),
      });
    }

    return response;
  }

  async findAll(
    projectId: string,
    criteria: WorkStreamListCriteria,
  ): Promise<WorkStreamResponseDto[]> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    await this.ensureProjectExists(parsedProjectId);

    const page = criteria.page || 1;
    const perPage = criteria.perPage || 20;

    const rows = await this.prisma.workStream.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
        ...(criteria.status ? { status: criteria.status } : {}),
      },
      orderBy: this.parseSort(criteria.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    });

    return rows.map((row) => this.toDto(row));
  }

  async findOne(
    projectId: string,
    workStreamId: string,
    includeWorks = false,
  ): Promise<WorkStreamResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedWorkStreamId = this.parseId(workStreamId, 'Work stream');
    await this.ensureProjectExists(parsedProjectId);

    const row = await this.prisma.workStream.findFirst({
      where: {
        id: parsedWorkStreamId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
      include: includeWorks
        ? {
            phaseWorkStreams: {
              include: {
                phase: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                    deletedAt: true,
                  },
                },
              },
              orderBy: {
                phaseId: 'asc',
              },
            },
          }
        : undefined,
    });

    if (!row) {
      throw new NotFoundException(
        `Work stream not found for project id ${projectId} and work stream id ${workStreamId}.`,
      );
    }

    return this.toDto(row as WorkStreamWithRelations);
  }

  async update(
    projectId: string,
    workStreamId: string,
    dto: UpdateWorkStreamDto,
    userId: string | number | undefined,
  ): Promise<WorkStreamResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedWorkStreamId = this.parseId(workStreamId, 'Work stream');
    await this.ensureProjectExists(parsedProjectId);
    const auditUserId = this.getAuditUserId(userId);

    const existing = await this.prisma.workStream.findFirst({
      where: {
        id: parsedWorkStreamId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Work stream not found for project id ${projectId} and work stream id ${workStreamId}.`,
      );
    }

    const updated = await this.prisma.workStream.update({
      where: {
        id: parsedWorkStreamId,
      },
      data: {
        name: dto.name,
        type: dto.type,
        status: dto.status,
        updatedBy: auditUserId,
      },
    });

    const response = this.toDto(updated);
    this.publishWorkstreamResourceEvent(
      KAFKA_TOPIC.PROJECT_WORKSTREAM_UPDATED,
      response,
    );

    if (existing.status !== updated.status) {
      if (updated.status === 'active') {
        this.publishNotification(KAFKA_TOPIC.PROJECT_WORK_TRANSITION_ACTIVE, {
          projectId,
          workstream: response,
          userId: this.getNotificationUserId(userId),
          initiatorUserId: this.getNotificationUserId(userId),
        });
      }

      if (updated.status === 'completed') {
        this.publishNotification(
          KAFKA_TOPIC.PROJECT_WORK_TRANSITION_COMPLETED,
          {
            projectId,
            workstream: response,
            userId: this.getNotificationUserId(userId),
            initiatorUserId: this.getNotificationUserId(userId),
          },
        );
      }
    }

    if (existing.name !== updated.name || existing.type !== updated.type) {
      this.publishNotification(KAFKA_TOPIC.PROJECT_WORK_UPDATE_SCOPE, {
        projectId,
        originalWorkstream: {
          id: existing.id.toString(),
          name: existing.name,
          type: existing.type,
          status: existing.status,
        },
        updatedWorkstream: response,
        userId: this.getNotificationUserId(userId),
        initiatorUserId: this.getNotificationUserId(userId),
      });
    }

    return response;
  }

  async delete(
    projectId: string,
    workStreamId: string,
    userId: string | number | undefined,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedWorkStreamId = this.parseId(workStreamId, 'Work stream');
    await this.ensureProjectExists(parsedProjectId);
    const auditUserId = this.getAuditUserId(userId);
    const deletedBy = this.getAuditUserIdNumber(userId);

    const existing = await this.prisma.workStream.findFirst({
      where: {
        id: parsedWorkStreamId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Work stream not found for project id ${projectId} and work stream id ${workStreamId}.`,
      );
    }

    const deleted = await this.prisma.workStream.update({
      where: {
        id: parsedWorkStreamId,
      },
      data: {
        deletedAt: new Date(),
        deletedBy,
        updatedBy: auditUserId,
      },
    });

    this.publishWorkstreamResourceEvent(
      KAFKA_TOPIC.PROJECT_WORKSTREAM_REMOVED,
      {
        id: deleted.id.toString(),
        projectId: deleted.projectId.toString(),
        name: deleted.name,
        type: deleted.type,
        status: deleted.status,
      },
    );
  }

  async ensureWorkStreamExists(
    projectId: string,
    workStreamId: string,
  ): Promise<void> {
    await this.findOne(projectId, workStreamId);
  }

  async listLinkedPhaseIds(
    projectId: string,
    workStreamId: string,
  ): Promise<bigint[]> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedWorkStreamId = this.parseId(workStreamId, 'Work stream');
    await this.ensureProjectExists(parsedProjectId);

    const links = await this.prisma.phaseWorkStream.findMany({
      where: {
        workStreamId: parsedWorkStreamId,
        workStream: {
          projectId: parsedProjectId,
          deletedAt: null,
        },
        phase: {
          projectId: parsedProjectId,
          deletedAt: null,
        },
      },
      select: {
        phaseId: true,
      },
      orderBy: {
        phaseId: 'asc',
      },
    });

    return links.map((link) => link.phaseId);
  }

  async ensurePhaseLinkedToWorkStream(
    projectId: string,
    workStreamId: string,
    phaseId: string,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedWorkStreamId = this.parseId(workStreamId, 'Work stream');
    const parsedPhaseId = this.parseId(phaseId, 'Work');
    await this.ensureProjectExists(parsedProjectId);

    const link = await this.prisma.phaseWorkStream.findFirst({
      where: {
        workStreamId: parsedWorkStreamId,
        phaseId: parsedPhaseId,
        workStream: {
          projectId: parsedProjectId,
          deletedAt: null,
        },
        phase: {
          projectId: parsedProjectId,
          deletedAt: null,
        },
      },
      select: {
        phaseId: true,
      },
    });

    if (!link) {
      throw new NotFoundException(
        `Work with id ${phaseId} is not linked to work stream id ${workStreamId} in project id ${projectId}.`,
      );
    }
  }

  async createLink(workStreamId: string, phaseId: string): Promise<void> {
    const parsedWorkStreamId = this.parseId(workStreamId, 'Work stream');
    const parsedPhaseId = this.parseId(phaseId, 'Work');

    await this.prisma.phaseWorkStream.create({
      data: {
        workStreamId: parsedWorkStreamId,
        phaseId: parsedPhaseId,
      },
    });
  }

  private async ensureProjectExists(projectId: bigint): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId.toString()} was not found.`,
      );
    }
  }

  private parseSort(sort?: string): Prisma.WorkStreamOrderByWithRelationInput {
    if (!sort || sort.trim().length === 0) {
      return {
        updatedAt: 'desc',
      };
    }

    const normalized = sort.trim();
    const withDirection = normalized.includes(' ')
      ? normalized
      : `${normalized} asc`;
    const [field, direction] = withDirection.split(/\s+/);

    if (!field || !direction) {
      throw new BadRequestException('Invalid sort criteria.');
    }

    if (!WORK_STREAM_SORT_FIELDS.includes(field)) {
      throw new BadRequestException('Invalid sort criteria.');
    }

    const normalizedDirection = direction.toLowerCase();
    if (normalizedDirection !== 'asc' && normalizedDirection !== 'desc') {
      throw new BadRequestException('Invalid sort criteria.');
    }

    return {
      [field]: normalizedDirection,
    };
  }

  private toDto(row: WorkStreamWithRelations): WorkStreamResponseDto {
    const response: WorkStreamResponseDto = {
      id: row.id.toString(),
      projectId: row.projectId.toString(),
      name: row.name,
      type: row.type,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy.toString(),
      updatedBy: row.updatedBy.toString(),
    };

    if (Array.isArray(row.phaseWorkStreams)) {
      response.works = row.phaseWorkStreams
        .filter((entry) => entry.phase && entry.phase.deletedAt === null)
        .map((entry) => ({
          id: entry.phase!.id.toString(),
          name: entry.phase!.name,
          status: entry.phase!.status,
        }));
    }

    return response;
  }

  private parseId(value: string, entityName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${entityName} id is invalid.`);
    }
  }

  private getAuditUserId(userId: string | number | undefined): bigint {
    if (typeof userId === 'number') {
      return BigInt(Math.trunc(userId));
    }

    if (typeof userId === 'string' && userId.trim().length > 0) {
      try {
        return BigInt(userId.trim());
      } catch {
        return BigInt(-1);
      }
    }

    return BigInt(-1);
  }

  private getAuditUserIdNumber(userId: string | number | undefined): number {
    if (typeof userId === 'number') {
      return Math.trunc(userId);
    }

    if (typeof userId === 'string' && userId.trim().length > 0) {
      const parsed = Number.parseInt(userId.trim(), 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return -1;
  }

  private publishWorkstreamResourceEvent(
    topic: string,
    payload: unknown,
  ): void {
    void publishWorkstreamEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish workstream event topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  private publishNotification(topic: string, payload: unknown): void {
    void publishNotificationEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish workstream notification topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  private getNotificationUserId(userId: string | number | undefined): string {
    if (typeof userId === 'number' && Number.isFinite(userId)) {
      return String(Math.trunc(userId));
    }

    const normalized = String(userId || '').trim();
    if (/^\d+$/.test(normalized)) {
      return normalized;
    }

    return '-1';
  }
}
