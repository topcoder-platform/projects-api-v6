import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectType } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { toSerializable } from '../utils/metadata-utils';
import { CreateProjectTypeDto } from './dto/create-project-type.dto';
import { ProjectTypeResponseDto } from './dto/project-type-response.dto';
import { UpdateProjectTypeDto } from './dto/update-project-type.dto';

@Injectable()
/**
 * Manages project type metadata records used to classify projects.
 *
 * Project types are keyed by unique string `key`.
 */
export class ProjectTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * Lists all non-deleted project types.
   */
  async findAll(): Promise<ProjectTypeResponseDto[]> {
    const records = await this.prisma.projectType.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ key: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  /**
   * Finds one project type by key.
   */
  async findByKey(key: string): Promise<ProjectTypeResponseDto> {
    const record = await this.prisma.projectType.findFirst({
      where: {
        key,
        deletedAt: null,
      },
    });

    if (!record) {
      throw new NotFoundException(`Project type not found for key ${key}.`);
    }

    return this.toDto(record);
  }

  /**
   * Creates a project type.
   */
  async create(
    dto: CreateProjectTypeDto,
    userId: number,
  ): Promise<ProjectTypeResponseDto> {
    try {
      // TODO (BUG): create() uses findUnique({ where: { key } }) without deletedAt: null. A soft-deleted record with the same key will trigger a ConflictException, preventing re-creation. Use findFirst with deletedAt: null instead.
      const existing = await this.prisma.projectType.findUnique({
        where: {
          key: dto.key,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Project type already exists for key ${dto.key}.`,
        );
      }

      const created = await this.prisma.projectType.create({
        data: {
          key: dto.key,
          displayName: dto.displayName,
          icon: dto.icon,
          question: dto.question,
          info: dto.info,
          aliases: dto.aliases as Prisma.InputJsonValue,
          metadata: dto.metadata as Prisma.InputJsonValue,
          disabled: dto.disabled || false,
          hidden: dto.hidden || false,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PROJECT_TYPE,
        created.key,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, `create project type ${dto.key}`);
    }
  }

  /**
   * Updates a project type by key.
   */
  async update(
    key: string,
    dto: UpdateProjectTypeDto,
    userId: number,
  ): Promise<ProjectTypeResponseDto> {
    try {
      const existing = await this.prisma.projectType.findFirst({
        where: {
          key,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Project type not found for key ${key}.`);
      }

      const updated = await this.prisma.projectType.update({
        where: {
          key,
        },
        data: {
          ...(typeof dto.displayName === 'undefined'
            ? {}
            : { displayName: dto.displayName }),
          ...(typeof dto.icon === 'undefined' ? {} : { icon: dto.icon }),
          ...(typeof dto.question === 'undefined'
            ? {}
            : { question: dto.question }),
          ...(typeof dto.info === 'undefined' ? {} : { info: dto.info }),
          ...(typeof dto.aliases === 'undefined'
            ? {}
            : { aliases: dto.aliases as Prisma.InputJsonValue }),
          ...(typeof dto.metadata === 'undefined'
            ? {}
            : { metadata: dto.metadata as Prisma.InputJsonValue }),
          ...(typeof dto.disabled === 'undefined'
            ? {}
            : { disabled: dto.disabled }),
          ...(typeof dto.hidden === 'undefined' ? {} : { hidden: dto.hidden }),
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PROJECT_TYPE,
        updated.key,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(error, `update project type ${key}`);
    }
  }

  /**
   * Soft deletes a project type.
   */
  async delete(key: string, userId: number): Promise<void> {
    try {
      const existing = await this.prisma.projectType.findFirst({
        where: {
          key,
          deletedAt: null,
        },
        select: {
          key: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(`Project type not found for key ${key}.`);
      }

      await this.prisma.projectType.update({
        where: {
          key,
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
        PROJECT_METADATA_RESOURCE.PROJECT_TYPE,
        key,
        { key },
        userId,
      );
    } catch (error) {
      this.handleError(error, `delete project type ${key}`);
    }
  }

  /**
   * Maps Prisma entity to response DTO.
   */
  private toDto(record: ProjectType): ProjectTypeResponseDto {
    return {
      key: record.key,
      displayName: record.displayName,
      icon: record.icon,
      question: record.question,
      info: record.info,
      aliases: toSerializable(record.aliases || []) as unknown[],
      metadata: toSerializable(record.metadata || {}) as Record<
        string,
        unknown
      >,
      disabled: record.disabled,
      hidden: record.hidden,
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
