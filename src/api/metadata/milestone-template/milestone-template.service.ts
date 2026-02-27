import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { MilestoneTemplate, Prisma } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { parseBigIntParam, toSerializable } from '../utils/metadata-utils';
import { CloneMilestoneTemplateDto } from './dto/clone-milestone-template.dto';
import { CreateMilestoneTemplateDto } from './dto/create-milestone-template.dto';
import { MilestoneTemplateResponseDto } from './dto/milestone-template-response.dto';
import { UpdateMilestoneTemplateDto } from './dto/update-milestone-template.dto';

@Injectable()
/**
 * Manages milestone templates, which are reusable milestone definitions linked
 * to a target `reference` and `referenceId`.
 *
 * Milestones can be cloned from an existing template to a new target.
 *
 * Note: this service's module is currently not imported by MetadataModule, so
 * endpoints are unreachable until that is fixed.
 */
export class MilestoneTemplateService {
  // TODO (BUG): This service's module (MilestoneTemplateModule) is not imported in MetadataModule. All endpoints are unreachable until it is added.
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * Lists all non-deleted milestone templates.
   */
  async findAll(): Promise<MilestoneTemplateResponseDto[]> {
    const records = await this.prisma.milestoneTemplate.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ reference: 'asc' }, { referenceId: 'asc' }, { order: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  /**
   * Finds one milestone template by id.
   */
  async findOne(id: bigint): Promise<MilestoneTemplateResponseDto> {
    const record = await this.prisma.milestoneTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Milestone template not found for id ${id.toString()}.`,
      );
    }

    return this.toDto(record);
  }

  /**
   * Creates a milestone template.
   */
  async create(
    dto: CreateMilestoneTemplateDto,
    userId: bigint,
  ): Promise<MilestoneTemplateResponseDto> {
    try {
      const created = await this.prisma.milestoneTemplate.create({
        data: {
          name: dto.name,
          description: dto.description,
          duration: dto.duration,
          type: dto.type,
          order: dto.order,
          plannedText: dto.plannedText,
          activeText: dto.activeText,
          completedText: dto.completedText,
          blockedText: dto.blockedText,
          hidden: dto.hidden || false,
          reference: dto.reference,
          referenceId: BigInt(dto.referenceId),
          metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.MILESTONE_TEMPLATE,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, 'create milestone template');
    }
  }

  /**
   * Clones an existing milestone template to a new reference target.
   *
   * Throws NotFoundException when `sourceMilestoneTemplateId` is invalid.
   */
  async clone(
    dto: CloneMilestoneTemplateDto,
    userId: bigint,
  ): Promise<MilestoneTemplateResponseDto> {
    try {
      const source = await this.prisma.milestoneTemplate.findFirst({
        where: {
          id: BigInt(dto.sourceMilestoneTemplateId),
          deletedAt: null,
        },
      });

      if (!source) {
        throw new NotFoundException(
          `Milestone template not found for id ${dto.sourceMilestoneTemplateId}.`,
        );
      }

      const created = await this.prisma.milestoneTemplate.create({
        data: {
          name: source.name,
          description: source.description,
          duration: source.duration,
          type: source.type,
          order: source.order,
          plannedText: source.plannedText,
          activeText: source.activeText,
          completedText: source.completedText,
          blockedText: source.blockedText,
          hidden: source.hidden,
          reference: dto.reference || source.reference,
          referenceId:
            typeof dto.referenceId === 'number'
              ? BigInt(dto.referenceId)
              : source.referenceId,
          metadata: source.metadata as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.MILESTONE_TEMPLATE,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, 'clone milestone template');
    }
  }

  /**
   * Updates a milestone template by id.
   */
  async update(
    id: bigint,
    dto: UpdateMilestoneTemplateDto,
    userId: bigint,
  ): Promise<MilestoneTemplateResponseDto> {
    try {
      const existing = await this.prisma.milestoneTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Milestone template not found for id ${id.toString()}.`,
        );
      }

      const updated = await this.prisma.milestoneTemplate.update({
        where: {
          id,
        },
        data: {
          ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
          ...(typeof dto.description === 'undefined'
            ? {}
            : { description: dto.description }),
          ...(typeof dto.duration === 'undefined'
            ? {}
            : { duration: dto.duration }),
          ...(typeof dto.type === 'undefined' ? {} : { type: dto.type }),
          ...(typeof dto.order === 'undefined' ? {} : { order: dto.order }),
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
          ...(typeof dto.reference === 'undefined'
            ? {}
            : { reference: dto.reference }),
          ...(typeof dto.referenceId === 'undefined'
            ? {}
            : { referenceId: BigInt(dto.referenceId) }),
          ...(typeof dto.metadata === 'undefined'
            ? {}
            : { metadata: dto.metadata as Prisma.InputJsonValue }),
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.MILESTONE_TEMPLATE,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(error, `update milestone template ${id.toString()}`);
    }
  }

  /**
   * Soft deletes a milestone template.
   */
  async delete(id: bigint, userId: bigint): Promise<void> {
    try {
      const existing = await this.prisma.milestoneTemplate.findFirst({
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
          `Milestone template not found for id ${id.toString()}.`,
        );
      }

      await this.prisma.milestoneTemplate.update({
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
        PROJECT_METADATA_RESOURCE.MILESTONE_TEMPLATE,
        id,
        { id: id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(error, `delete milestone template ${id.toString()}`);
    }
  }

  /**
   * Parses milestone template id parameter.
   */
  parseId(value: string): bigint {
    return parseBigIntParam(value, 'milestoneTemplateId');
  }

  /**
   * Maps Prisma entity to response DTO.
   */
  private toDto(record: MilestoneTemplate): MilestoneTemplateResponseDto {
    return {
      id: record.id.toString(),
      name: record.name,
      description: record.description,
      duration: record.duration,
      type: record.type,
      order: record.order,
      plannedText: record.plannedText,
      activeText: record.activeText,
      completedText: record.completedText,
      blockedText: record.blockedText,
      hidden: record.hidden,
      reference: record.reference,
      referenceId: record.referenceId.toString(),
      metadata: toSerializable(record.metadata || {}) as Record<
        string,
        unknown
      >,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy.toString(),
      updatedBy: record.updatedBy.toString(),
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
