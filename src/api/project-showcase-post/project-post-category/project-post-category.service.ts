import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectPostCategory } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from 'src/api/metadata/utils/metadata-event.utils';
import { toSerializable } from 'src/api/metadata/utils/metadata-utils';
import { CreateProjectPostCategoryDto } from './dto/create-project-post-category.dto';
import { ProjectPostCategoryResponseDto } from './dto/project-post-category-response.dto';
import { UpdateProjectPostCategoryDto } from './dto/update-project-post-category.dto';

@Injectable()
export class ProjectPostCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  async findAll(): Promise<ProjectPostCategoryResponseDto[]> {
    const records = await this.prisma.projectPostCategory.findMany({
      orderBy: [{ id: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  async findById(id: string): Promise<ProjectPostCategoryResponseDto> {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException(`Category not found for id ${id}.`);
    }

    const record = await this.prisma.projectPostCategory.findFirst({
      where: {
        id: BigInt(parsedId),
      },
    });

    if (!record) {
      throw new NotFoundException(`Category not found for id ${id}.`);
    }

    return this.toDto(record);
  }

  async create(
    dto: CreateProjectPostCategoryDto,
    userId: number,
  ): Promise<ProjectPostCategoryResponseDto> {
    try {
      const existing = await this.prisma.projectPostCategory.findFirst({
        where: {
          name: dto.name,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Project showcase post category already exists for name ${dto.name}.`,
        );
      }

      const created = await this.prisma.projectPostCategory.create({
        data: {
          name: dto.name,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PROJECT_POST_CATEGORY,
        String(created.id),
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, `create project showcase post category ${dto.name}`);
    }
  }

  async update(
    id: string,
    dto: UpdateProjectPostCategoryDto,
    userId: number,
  ): Promise<ProjectPostCategoryResponseDto> {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException(`Category not found for id ${id}.`);
    }

    const existing = await this.prisma.projectPostCategory.findFirst({
      where: {
        id: BigInt(parsedId),
      },
    });

    if (!existing) {
      throw new NotFoundException(`Category not found for id ${id}.`);
    }

    const updated = await this.prisma.projectPostCategory.update({
      where: { id: BigInt(parsedId) },
      data: {
        ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
      },
    });

    await publishMetadataEvent(
      this.eventBusService,
      'PROJECT_METADATA_UPDATE',
      PROJECT_METADATA_RESOURCE.PROJECT_POST_CATEGORY,
      String(updated.id),
      updated,
      userId,
    );

    return this.toDto(updated);
  }

  async delete(id: string, userId: number): Promise<void> {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException(`Category not found for id ${id}.`);
    }

    const existing = await this.prisma.projectPostCategory.findFirst({
      where: {
        id: BigInt(parsedId),
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Category not found for id ${id}.`);
    }

    await this.prisma.projectPostCategory.delete({
      where: { id: BigInt(parsedId) },
    });

    await publishMetadataEvent(
      this.eventBusService,
      'PROJECT_METADATA_DELETE',
      PROJECT_METADATA_RESOURCE.PROJECT_POST_CATEGORY,
      String(parsedId),
      { id: parsedId },
      userId,
    );
  }

  private toDto(record: ProjectPostCategory): ProjectPostCategoryResponseDto {
    return {
      id: String(record.id),
      name: record.name,
    };
  }

  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
