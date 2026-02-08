import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriceConfig, Prisma } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { PriceConfigResponseDto } from './dto/price-config-response.dto';

@Injectable()
export class PriceConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  async findLatestRevisionOfLatestVersion(
    key: string,
  ): Promise<PriceConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const priceConfig = await this.prisma.priceConfig.findFirst({
      where: {
        key: normalizedKey,
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    if (!priceConfig) {
      throw new NotFoundException(
        `PriceConfig not found for key ${normalizedKey}.`,
      );
    }

    return this.toDto(priceConfig);
  }

  async findAllVersions(key: string): Promise<PriceConfigResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    const records = await this.prisma.priceConfig.findMany({
      where: {
        key: normalizedKey,
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    if (records.length === 0) {
      throw new NotFoundException(
        `PriceConfig not found for key ${normalizedKey}.`,
      );
    }

    const latestByVersion = new Map<string, PriceConfig>();

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
  ): Promise<PriceConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const priceConfig = await this.prisma.priceConfig.findFirst({
      where: {
        key: normalizedKey,
        version,
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
    });

    if (!priceConfig) {
      throw new NotFoundException(
        `PriceConfig not found for key ${normalizedKey} version ${version.toString()}.`,
      );
    }

    return this.toDto(priceConfig);
  }

  async findAllRevisions(
    key: string,
    version: bigint,
  ): Promise<PriceConfigResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    const forms = await this.prisma.priceConfig.findMany({
      where: {
        key: normalizedKey,
        version,
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
    });

    if (forms.length === 0) {
      throw new NotFoundException(
        `PriceConfig not found for key ${normalizedKey} version ${version.toString()}.`,
      );
    }

    return forms.map((priceConfig) => this.toDto(priceConfig));
  }

  async findSpecificRevision(
    key: string,
    version: bigint,
    revision: bigint,
  ): Promise<PriceConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const priceConfig = await this.prisma.priceConfig.findFirst({
      where: {
        key: normalizedKey,
        version,
        revision,
        deletedAt: null,
      },
    });

    if (!priceConfig) {
      throw new NotFoundException(
        `PriceConfig not found for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}.`,
      );
    }

    return this.toDto(priceConfig);
  }

  async createVersion(
    key: string,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<PriceConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.priceConfig.findFirst({
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

      const created = await this.prisma.priceConfig.create({
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
        PROJECT_METADATA_RESOURCE.PRICE_CONFIG_VERSION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(
        error,
        `create priceConfig version for key ${normalizedKey}`,
      );
    }
  }

  async createRevision(
    key: string,
    version: bigint,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<PriceConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.priceConfig.findFirst({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        orderBy: [{ revision: 'desc' }],
      });

      if (!latest) {
        throw new NotFoundException(
          `PriceConfig not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      const created = await this.prisma.priceConfig.create({
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
        PROJECT_METADATA_RESOURCE.PRICE_CONFIG_REVISION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(
        error,
        `create priceConfig revision for key ${normalizedKey} version ${version.toString()}`,
      );
    }
  }

  async updateVersion(
    key: string,
    version: bigint,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<PriceConfigResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.priceConfig.findFirst({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        orderBy: [{ revision: 'desc' }],
      });

      if (!latest) {
        throw new NotFoundException(
          `PriceConfig not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      const updated = await this.prisma.priceConfig.update({
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
        PROJECT_METADATA_RESOURCE.PRICE_CONFIG_VERSION,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(
        error,
        `update priceConfig version for key ${normalizedKey} version ${version.toString()}`,
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
      const forms = await this.prisma.priceConfig.findMany({
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
          `PriceConfig not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      await this.prisma.priceConfig.updateMany({
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
        forms.map((priceConfig) =>
          publishMetadataEvent(
            this.eventBusService,
            'PROJECT_METADATA_DELETE',
            PROJECT_METADATA_RESOURCE.PRICE_CONFIG_VERSION,
            priceConfig.id,
            { id: priceConfig.id.toString() },
            userId,
          ),
        ),
      );
    } catch (error) {
      this.handleError(
        error,
        `delete priceConfig version for key ${normalizedKey} version ${version.toString()}`,
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
      const priceConfig = await this.prisma.priceConfig.findFirst({
        where: {
          key: normalizedKey,
          version,
          revision,
          deletedAt: null,
        },
      });

      if (!priceConfig) {
        throw new NotFoundException(
          `PriceConfig not found for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}.`,
        );
      }

      const deleted = await this.prisma.priceConfig.update({
        where: {
          id: priceConfig.id,
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
        PROJECT_METADATA_RESOURCE.PRICE_CONFIG_REVISION,
        deleted.id,
        { id: deleted.id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(
        error,
        `delete priceConfig revision for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}`,
      );
    }
  }

  private toDto(priceConfig: PriceConfig): PriceConfigResponseDto {
    return {
      id: priceConfig.id.toString(),
      key: priceConfig.key,
      version: priceConfig.version.toString(),
      revision: priceConfig.revision.toString(),
      config:
        typeof priceConfig.config === 'object' && priceConfig.config !== null
          ? (priceConfig.config as Record<string, unknown>)
          : {},
      createdAt: priceConfig.createdAt,
      updatedAt: priceConfig.updatedAt,
      createdBy: priceConfig.createdBy,
      updatedBy: priceConfig.updatedBy,
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
