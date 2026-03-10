import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkManagementPermission } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { parseBigIntParam, toSerializable } from '../utils/metadata-utils';
import { CreateWorkManagementPermissionDto } from './dto/create-work-management-permission.dto';
import { WorkManagementPermissionCriteriaDto } from './dto/work-management-permission-criteria.dto';
import { UpdateWorkManagementPermissionDto } from './dto/update-work-management-permission.dto';
import { WorkManagementPermissionResponseDto } from './dto/work-management-permission-response.dto';

@Injectable()
/**
 * Manages work management permission records for each `policy` and
 * `projectTemplateId` pair.
 *
 * These records are used by platform UI flows to enforce permission-driven
 * behavior per project template.
 */
export class WorkManagementPermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * Lists permissions for a project template.
   */
  async findAll(
    criteria: WorkManagementPermissionCriteriaDto,
  ): Promise<WorkManagementPermissionResponseDto[]> {
    const records = await this.prisma.workManagementPermission.findMany({
      where: {
        projectTemplateId: BigInt(criteria.projectTemplateId),
        deletedAt: null,
      },
      orderBy: [{ id: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  /**
   * Finds one permission by id.
   */
  async findOne(id: bigint): Promise<WorkManagementPermissionResponseDto> {
    const record = await this.prisma.workManagementPermission.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Work management permission not found for id ${id.toString()}.`,
      );
    }

    return this.toDto(record);
  }

  /**
   * Creates a permission record.
   *
   * Throws:
   * - NotFoundException when `projectTemplateId` does not exist.
   * - ConflictException when `(policy, projectTemplateId)` already exists.
   */
  async create(
    dto: CreateWorkManagementPermissionDto,
    userId: number,
  ): Promise<WorkManagementPermissionResponseDto> {
    try {
      await this.ensureProjectTemplateExists(BigInt(dto.projectTemplateId));

      const existing = await this.prisma.workManagementPermission.findFirst({
        where: {
          policy: dto.policy,
          projectTemplateId: BigInt(dto.projectTemplateId),
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Work management permission already exists for policy ${dto.policy} and projectTemplateId ${dto.projectTemplateId}.`,
        );
      }

      const created = await this.prisma.workManagementPermission.create({
        data: {
          policy: dto.policy,
          permission: dto.permission as Prisma.InputJsonValue,
          projectTemplateId: BigInt(dto.projectTemplateId),
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.WORK_MANAGEMENT_PERMISSION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, 'create work management permission');
    }
  }

  /**
   * Updates a permission record.
   *
   * Throws:
   * - NotFoundException when record or project template does not exist.
   * - ConflictException when resulting `(policy, projectTemplateId)` conflicts.
   */
  async update(
    id: bigint,
    dto: UpdateWorkManagementPermissionDto,
    userId: number,
  ): Promise<WorkManagementPermissionResponseDto> {
    try {
      const existing = await this.prisma.workManagementPermission.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Work management permission not found for id ${id.toString()}.`,
        );
      }

      const projectTemplateId =
        typeof dto.projectTemplateId === 'number'
          ? BigInt(dto.projectTemplateId)
          : existing.projectTemplateId;

      await this.ensureProjectTemplateExists(projectTemplateId);

      const duplicated = await this.prisma.workManagementPermission.findFirst({
        where: {
          policy: dto.policy || existing.policy,
          projectTemplateId,
          id: {
            not: id,
          },
          deletedAt: null,
        },
      });

      if (duplicated) {
        throw new ConflictException(
          `Work management permission already exists for policy ${dto.policy || existing.policy} and projectTemplateId ${projectTemplateId.toString()}.`,
        );
      }

      const updated = await this.prisma.workManagementPermission.update({
        where: {
          id,
        },
        data: {
          ...(typeof dto.policy === 'undefined' ? {} : { policy: dto.policy }),
          ...(typeof dto.permission === 'undefined'
            ? {}
            : { permission: dto.permission as Prisma.InputJsonValue }),
          ...(typeof dto.projectTemplateId === 'undefined'
            ? {}
            : { projectTemplateId: BigInt(dto.projectTemplateId) }),
          updatedBy: userId,
        } as Prisma.WorkManagementPermissionUncheckedUpdateInput,
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.WORK_MANAGEMENT_PERMISSION,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(
        error,
        `update work management permission ${id.toString()}`,
      );
    }
  }

  /**
   * Soft deletes a permission record.
   */
  async delete(id: bigint, userId: number): Promise<void> {
    try {
      const existing = await this.prisma.workManagementPermission.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Work management permission not found for id ${id.toString()}.`,
        );
      }

      await this.prisma.workManagementPermission.update({
        where: {
          id,
        },
        data: {
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_DELETE',
        PROJECT_METADATA_RESOURCE.WORK_MANAGEMENT_PERMISSION,
        id,
        { id: id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(
        error,
        `delete work management permission ${id.toString()}`,
      );
    }
  }

  /**
   * Parses a permission id route/query parameter.
   */
  parseId(value: string): bigint {
    return parseBigIntParam(value, 'id');
  }

  /**
   * Validates that referenced project template exists.
   */
  private async ensureProjectTemplateExists(
    projectTemplateId: bigint,
  ): Promise<void> {
    const projectTemplate = await this.prisma.projectTemplate.findFirst({
      where: {
        id: projectTemplateId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!projectTemplate) {
      throw new NotFoundException(
        `Project template not found for id ${projectTemplateId.toString()}.`,
      );
    }
  }

  /**
   * Maps Prisma entity to response DTO.
   */
  private toDto(
    record: WorkManagementPermission,
  ): WorkManagementPermissionResponseDto {
    return {
      id: record.id.toString(),
      policy: record.policy,
      permission: toSerializable(record.permission || {}) as Record<
        string,
        unknown
      >,
      projectTemplateId: record.projectTemplateId.toString(),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
    };
  }

  /**
   * Re-throws framework HTTP exceptions and delegates unknown errors to Prisma.
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
