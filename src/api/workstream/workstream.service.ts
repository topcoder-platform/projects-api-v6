import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkStream } from '@prisma/client';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { parseSortParam } from 'src/shared/utils/query.utils';
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
/**
 * Business logic for work streams. Manages CRUD and the `phase_work_streams`
 * join table linking phases (works) to work streams. Exposes helper methods
 * (`ensureWorkStreamExists`, `listLinkedPhaseIds`,
 * `ensurePhaseLinkedToWorkStream`, `createLink`) used by alias work/work-item
 * controllers.
 */
export class WorkStreamService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a work stream and stores audit fields from the caller user id.
   *
   * @param projectId - Project id from the route.
   * @param dto - Create payload.
   * @param userId - Caller user id for audit columns.
   * @returns Created work stream DTO.
   * @throws {BadRequestException} When route id is invalid.
   * @throws {NotFoundException} When project does not exist.
   */
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
    // TODO [QUALITY]: Remove `void` suppressions; these variables are already consumed earlier in the method.
    void projectId;
    void userId;

    return response;
  }

  /**
   * Returns paginated work streams with optional status filtering and sort.
   *
   * @param projectId - Project id from the route.
   * @param criteria - List criteria.
   * @returns Work stream DTO list.
   * @throws {BadRequestException} When route id or sort is invalid.
   * @throws {NotFoundException} When project does not exist.
   */
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

  /**
   * Fetches one work stream, optionally including linked works (phases).
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param includeWorks - Whether linked works should be included.
   * @returns Work stream DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When project or work stream is missing.
   */
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

  /**
   * Partially updates work stream fields (`name`, `type`, `status`).
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param dto - Update payload.
   * @param userId - Caller user id for audit columns.
   * @returns Updated work stream DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When project or work stream is missing.
   */
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
    // TODO [QUALITY]: Remove `void` suppressions; these variables are already consumed earlier in the method.
    void projectId;
    void userId;
    void existing;

    return response;
  }

  /**
   * Soft deletes a work stream.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param userId - Caller user id for audit columns.
   * @returns Nothing.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When project or work stream is missing.
   */
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

  /**
   * Guard helper that ensures a work stream exists in a project.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @returns Nothing.
   * @throws {NotFoundException} When work stream is missing.
   */
  async ensureWorkStreamExists(
    projectId: string,
    workStreamId: string,
  ): Promise<void> {
    await this.findOne(projectId, workStreamId);
  }

  /**
   * Lists linked phase ids for a work stream in ascending phase id order.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @returns Ordered phase id array.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When project is missing.
   */
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

  /**
   * Guard helper that ensures a phase is linked to a work stream.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param phaseId - Phase id from the route.
   * @returns Nothing.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When no link exists.
   */
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

  /**
   * Creates a phase/work-stream link row.
   *
   * @param workStreamId - Work stream id.
   * @param phaseId - Phase id.
   * @returns Nothing.
   * @throws {BadRequestException} When ids are invalid.
   */
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

  /**
   * Ensures a project exists and is not soft deleted.
   *
   * @param projectId - Parsed project id.
   * @returns Nothing.
   * @throws {NotFoundException} When project does not exist.
   */
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

  /**
   * Validates and parses work stream list sort expression.
   *
   * @param sort - Sort expression (`field direction`).
   * @returns Prisma orderBy object.
   * @throws {BadRequestException} When field/direction is invalid.
   */
  private parseSort(sort?: string): Prisma.WorkStreamOrderByWithRelationInput {
    return parseSortParam(sort, WORK_STREAM_SORT_FIELDS, {
      updatedAt: 'desc',
    }) as Prisma.WorkStreamOrderByWithRelationInput;
  }

  /**
   * Maps work stream entities (with optional linked phase relation) to DTO.
   *
   * @param row - Work stream row.
   * @returns Response DTO.
   */
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

  /**
   * Parses route ids as bigint values.
   *
   * @param value - Raw id value.
   * @param entityName - Entity label for errors.
   * @returns Parsed id.
   * @throws {BadRequestException} When parsing fails.
   */
  private parseId(value: string, entityName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${entityName} id is invalid.`);
    }
  }

  /**
   * Parses caller user id into bigint for audit columns.
   *
   * @param userId - Raw user id value.
   * @returns Parsed audit user id, or `-1n` fallback.
   */
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

  /**
   * Parses caller user id into number for numeric audit columns.
   *
   * @param userId - Raw user id value.
   * @returns Parsed numeric user id, or `-1` fallback.
   */
  // TODO [QUALITY]: Consolidate into a single `getAuditUserId(userId): number` helper (consistent with other services) and cast to `BigInt` at the call site.
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
