import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkStream } from '@prisma/client';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
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
    void projectId;
    void userId;

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

    return this.toDto(row);
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
    void projectId;
    void userId;
    void existing;

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

    void deleted;
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
}
