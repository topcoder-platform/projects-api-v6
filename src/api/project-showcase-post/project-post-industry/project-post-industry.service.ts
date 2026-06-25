import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectPostIndustry } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from 'src/api/metadata/utils/metadata-event.utils';
import { toSerializable } from 'src/api/metadata/utils/metadata-utils';
import { CreateProjectPostIndustryDto } from './dto/create-project-post-industry.dto';
import { ProjectPostIndustryResponseDto } from './dto/project-post-industry-response.dto';
import { UpdateProjectPostIndustryDto } from './dto/update-project-post-industry.dto';

@Injectable()
export class ProjectPostIndustryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  async findAll(): Promise<ProjectPostIndustryResponseDto[]> {
    const records = await this.prisma.projectPostIndustry.findMany({
      orderBy: [{ id: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  async findById(id: string): Promise<ProjectPostIndustryResponseDto> {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException(`Industry not found for id ${id}.`);
    }

    const record = await this.prisma.projectPostIndustry.findFirst({
      where: {
        id: BigInt(parsedId),
      },
    });

    if (!record) {
      throw new NotFoundException(`Industry not found for id ${id}.`);
    }

    return this.toDto(record);
  }

  async create(
    dto: CreateProjectPostIndustryDto,
    userId: number,
  ): Promise<ProjectPostIndustryResponseDto> {
    try {
      const existing = await this.prisma.projectPostIndustry.findFirst({
        where: {
          name: dto.name,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Project showcase post industry already exists for name ${dto.name}.`,
        );
      }

      const created = await this.prisma.projectPostIndustry.create({
        data: {
          name: dto.name,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PROJECT_POST_INDUSTRY,
        String(created.id),
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, `create project showcase post industry ${dto.name}`);
    }
  }

  async update(
    id: string,
    dto: UpdateProjectPostIndustryDto,
    userId: number,
  ): Promise<ProjectPostIndustryResponseDto> {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException(`Industry not found for id ${id}.`);
    }

    const existing = await this.prisma.projectPostIndustry.findFirst({
      where: {
        id: BigInt(parsedId),
      },
    });

    if (!existing) {
      throw new NotFoundException(`Industry not found for id ${id}.`);
    }

    const updated = await this.prisma.projectPostIndustry.update({
      where: { id: BigInt(parsedId) },
      data: {
        ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
      },
    });

    await publishMetadataEvent(
      this.eventBusService,
      'PROJECT_METADATA_UPDATE',
      PROJECT_METADATA_RESOURCE.PROJECT_POST_INDUSTRY,
      String(updated.id),
      updated,
      userId,
    );

    return this.toDto(updated);
  }

  async delete(id: string, userId: number): Promise<void> {
    const parsedId = parseInt(id, 10);
    if (Number.isNaN(parsedId)) {
      throw new NotFoundException(`Industry not found for id ${id}.`);
    }

    const existing = await this.prisma.projectPostIndustry.findFirst({
      where: {
        id: BigInt(parsedId),
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Industry not found for id ${id}.`);
    }

    await this.prisma.projectPostIndustry.delete({
      where: { id: BigInt(parsedId) },
    });

    await publishMetadataEvent(
      this.eventBusService,
      'PROJECT_METADATA_DELETE',
      PROJECT_METADATA_RESOURCE.PROJECT_POST_INDUSTRY,
      String(parsedId),
      { id: parsedId },
      userId,
    );
  }

  private toDto(record: ProjectPostIndustry): ProjectPostIndustryResponseDto {
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
