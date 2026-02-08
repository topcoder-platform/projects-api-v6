import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanConfig, Prisma } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { PlanConfigResponseDto } from './dto/plan-config-response.dto';

@Injectable()
export class PlanConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  async findLatestRevisionOfLatestVersion(
    key: string,
  ): Promise<PlanConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const planConfig = await this.prisma.planConfig.findFirst({
      where: {
        key: normalizedKey,
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    if (!planConfig) {
      throw new NotFoundException(
        `PlanConfig not found for key ${normalizedKey}.`,
      );
    }

    return this.toDto(planConfig);
  }

  async findAllVersions(key: string): Promise<PlanConfigResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    const records = await this.prisma.planConfig.findMany({
      where: {
        key: normalizedKey,
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    if (records.length === 0) {
      throw new NotFoundException(
        `PlanConfig not found for key ${normalizedKey}.`,
      );
    }

    const latestByVersion = new Map<string, PlanConfig>();

    for (const record of records) {
      const versionKey = record.version.toString();
      if (!latestByVersion.has(versionKey)) {
        latestByVersion.set(versionKey, record);
      }
    }

    return Array.from(latestByVersion.values()).map((record) =>
      this.toDto(record),
    );
  }

  async findLatestRevisionOfVersion(
    key: string,
    version: bigint,
  ): Promise<PlanConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const planConfig = await this.prisma.planConfig.findFirst({
      where: {
        key: normalizedKey,
        version,
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
    });

    if (!planConfig) {
      throw new NotFoundException(
        `PlanConfig not found for key ${normalizedKey} version ${version.toString()}.`,
      );
    }

    return this.toDto(planConfig);
  }

  async findAllRevisions(
    key: string,
    version: bigint,
  ): Promise<PlanConfigResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    const forms = await this.prisma.planConfig.findMany({
      where: {
        key: normalizedKey,
        version,
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
    });

    if (forms.length === 0) {
      throw new NotFoundException(
        `PlanConfig not found for key ${normalizedKey} version ${version.toString()}.`,
      );
    }

    return forms.map((planConfig) => this.toDto(planConfig));
  }

  async findSpecificRevision(
    key: string,
    version: bigint,
    revision: bigint,
  ): Promise<PlanConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const planConfig = await this.prisma.planConfig.findFirst({
      where: {
        key: normalizedKey,
        version,
        revision,
        deletedAt: null,
      },
    });

    if (!planConfig) {
      throw new NotFoundException(
        `PlanConfig not found for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}.`,
      );
    }

    return this.toDto(planConfig);
  }

  async createVersion(
    key: string,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<PlanConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.planConfig.findFirst({
        where: {
          key: normalizedKey,
          deletedAt: null,
        },
        orderBy: [{ version: 'desc' }, { revision: 'desc' }],
        select: {
          version: true,
        },
      });

      const version = latest ? latest.version + BigInt(1) : BigInt(1);

      const created = await this.prisma.planConfig.create({
        data: {
          key: normalizedKey,
          version,
          revision: BigInt(1),
          config: config as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PLAN_CONFIG_VERSION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(
        error,
        `create planConfig version for key ${normalizedKey}`,
      );
    }
  }

  async createRevision(
    key: string,
    version: bigint,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<PlanConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.planConfig.findFirst({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        orderBy: [{ revision: 'desc' }],
      });

      if (!latest) {
        throw new NotFoundException(
          `PlanConfig not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      const created = await this.prisma.planConfig.create({
        data: {
          key: normalizedKey,
          version,
          revision: latest.revision + BigInt(1),
          config: config as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PLAN_CONFIG_REVISION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(
        error,
        `create planConfig revision for key ${normalizedKey} version ${version.toString()}`,
      );
    }
  }

  async updateVersion(
    key: string,
    version: bigint,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<PlanConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.planConfig.findFirst({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        orderBy: [{ revision: 'desc' }],
      });

      if (!latest) {
        throw new NotFoundException(
          `PlanConfig not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      const updated = await this.prisma.planConfig.update({
        where: {
          id: latest.id,
        },
        data: {
          config: config as Prisma.InputJsonValue,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PLAN_CONFIG_VERSION,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(
        error,
        `update planConfig version for key ${normalizedKey} version ${version.toString()}`,
      );
    }
  }

  async deleteVersion(
    key: string,
    version: bigint,
    userId: number,
  ): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const forms = await this.prisma.planConfig.findMany({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (forms.length === 0) {
        throw new NotFoundException(
          `PlanConfig not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      await this.prisma.planConfig.updateMany({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
        },
      });

      await Promise.all(
        forms.map((planConfig) =>
          publishMetadataEvent(
            this.eventBusService,
            'PROJECT_METADATA_DELETE',
            PROJECT_METADATA_RESOURCE.PLAN_CONFIG_VERSION,
            planConfig.id,
            { id: planConfig.id.toString() },
            userId,
          ),
        ),
      );
    } catch (error) {
      this.handleError(
        error,
        `delete planConfig version for key ${normalizedKey} version ${version.toString()}`,
      );
    }
  }

  async deleteRevision(
    key: string,
    version: bigint,
    revision: bigint,
    userId: number,
  ): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const planConfig = await this.prisma.planConfig.findFirst({
        where: {
          key: normalizedKey,
          version,
          revision,
          deletedAt: null,
        },
      });

      if (!planConfig) {
        throw new NotFoundException(
          `PlanConfig not found for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}.`,
        );
      }

      const deleted = await this.prisma.planConfig.update({
        where: {
          id: planConfig.id,
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
        PROJECT_METADATA_RESOURCE.PLAN_CONFIG_REVISION,
        deleted.id,
        { id: deleted.id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(
        error,
        `delete planConfig revision for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}`,
      );
    }
  }

  private toDto(planConfig: PlanConfig): PlanConfigResponseDto {
    return {
      id: planConfig.id.toString(),
      key: planConfig.key,
      version: planConfig.version.toString(),
      revision: planConfig.revision.toString(),
      config:
        typeof planConfig.config === 'object' && planConfig.config !== null
          ? (planConfig.config as Record<string, unknown>)
          : {},
      createdAt: planConfig.createdAt,
      updatedAt: planConfig.updatedAt,
      createdBy: planConfig.createdBy,
      updatedBy: planConfig.updatedBy,
    };
  }

  private normalizeKey(key: string): string {
    const normalized = String(key || '').trim();

    if (!normalized) {
      throw new BadRequestException('Metadata key is required.');
    }

    return normalized;
  }

  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
