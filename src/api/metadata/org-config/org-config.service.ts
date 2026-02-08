import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgConfig } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { parseBigIntParam } from '../utils/metadata-utils';
import { CreateOrgConfigDto } from './dto/create-org-config.dto';
import { OrgConfigResponseDto } from './dto/org-config-response.dto';
import { UpdateOrgConfigDto } from './dto/update-org-config.dto';

@Injectable()
export class OrgConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  async findAll(): Promise<OrgConfigResponseDto[]> {
    const records = await this.prisma.orgConfig.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ id: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  async findOne(id: bigint): Promise<OrgConfigResponseDto> {
    const record = await this.prisma.orgConfig.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Org config not found for id ${id.toString()}.`,
      );
    }

    return this.toDto(record);
  }

  async create(
    dto: CreateOrgConfigDto,
    userId: bigint,
  ): Promise<OrgConfigResponseDto> {
    try {
      const existing = await this.prisma.orgConfig.findFirst({
        where: {
          orgId: dto.orgId,
          configName: dto.configName,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Org config already exists for orgId ${dto.orgId} and configName ${dto.configName}.`,
        );
      }

      const created = await this.prisma.orgConfig.create({
        data: {
          orgId: dto.orgId,
          configName: dto.configName,
          configValue: dto.configValue,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.ORG_CONFIG,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, `create org config for orgId ${dto.orgId}`);
    }
  }

  async update(
    id: bigint,
    dto: UpdateOrgConfigDto,
    userId: bigint,
  ): Promise<OrgConfigResponseDto> {
    try {
      const existing = await this.prisma.orgConfig.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Org config not found for id ${id.toString()}.`,
        );
      }

      if (dto.orgId || dto.configName) {
        const duplicated = await this.prisma.orgConfig.findFirst({
          where: {
            orgId: dto.orgId || existing.orgId,
            configName: dto.configName || existing.configName,
            id: {
              not: id,
            },
            deletedAt: null,
          },
        });

        if (duplicated) {
          throw new ConflictException(
            `Org config already exists for orgId ${dto.orgId || existing.orgId} and configName ${dto.configName || existing.configName}.`,
          );
        }
      }

      const updated = await this.prisma.orgConfig.update({
        where: {
          id,
        },
        data: {
          ...(typeof dto.orgId === 'undefined' ? {} : { orgId: dto.orgId }),
          ...(typeof dto.configName === 'undefined'
            ? {}
            : { configName: dto.configName }),
          ...(typeof dto.configValue === 'undefined'
            ? {}
            : { configValue: dto.configValue }),
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.ORG_CONFIG,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(error, `update org config ${id.toString()}`);
    }
  }

  async delete(id: bigint, userId: bigint): Promise<void> {
    try {
      const existing = await this.prisma.orgConfig.findFirst({
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
          `Org config not found for id ${id.toString()}.`,
        );
      }

      await this.prisma.orgConfig.update({
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
        PROJECT_METADATA_RESOURCE.ORG_CONFIG,
        id,
        { id: id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(error, `delete org config ${id.toString()}`);
    }
  }

  parseId(id: string): bigint {
    return parseBigIntParam(id, 'id');
  }

  private toDto(record: OrgConfig): OrgConfigResponseDto {
    return {
      id: record.id.toString(),
      orgId: record.orgId,
      configName: record.configName,
      configValue: record.configValue,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy.toString(),
      updatedBy: record.updatedBy.toString(),
    };
  }

  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
