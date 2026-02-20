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
/**
 * Manages versioned plan configurations (phase and milestone plans) referenced
 * by project templates.
 */
export class PlanConfigService {
  // TODO (DRY): FormService, PlanConfigService, and PriceConfigService are structurally identical. Consider extracting a generic AbstractVersionedConfigService<T, TDto> base class parameterized on the Prisma delegate and DTO mapper.
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * Returns the latest revision from the latest version for a key.
   *
   * @param key Metadata key.
   * @returns Latest revision DTO for the latest version.
   * @throws {NotFoundException} If the key does not exist.
   */
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

  /**
   * Returns one record per version (latest revision of each version).
   *
   * @param key Metadata key.
   * @returns Latest revision DTO per version.
   * @throws {NotFoundException} If the key does not exist.
   */
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

  /**
   * Returns the latest revision of a specific version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @returns Latest revision DTO for the version.
   * @throws {NotFoundException} If the key/version does not exist.
   */
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

  /**
   * Returns all revisions for a specific version, newest first.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @returns Revision DTOs for the version.
   * @throws {NotFoundException} If the key/version does not exist.
   */
  async findAllRevisions(
    key: string,
    version: bigint,
  ): Promise<PlanConfigResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    // TODO (DRY): variable named 'forms' should be 'planConfigs' — copy-paste error.
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

  /**
   * Returns an exact key/version/revision record.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param revision Target revision number.
   * @returns Matching revision DTO.
   * @throws {NotFoundException} If the exact revision does not exist.
   */
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

  /**
   * Creates a new version with revision `1`.
   *
   * @param key Metadata key.
   * @param config Configuration payload.
   * @param userId Audit user id.
   * @returns Created version DTO.
   * @throws {BadRequestException} If key is empty.
   */
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

  /**
   * Creates a new revision for an existing version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param config Configuration payload.
   * @param userId Audit user id.
   * @returns Created revision DTO.
   * @throws {NotFoundException} If the key/version does not exist.
   * @throws {BadRequestException} If key is empty.
   */
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

  /**
   * Updates configuration on the latest revision of a version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param config Replacement configuration payload.
   * @param userId Audit user id.
   * @returns Updated version DTO.
   * @throws {NotFoundException} If the key/version does not exist.
   */
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

  /**
   * Soft deletes all revisions for a version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param userId Audit user id.
   * @throws {NotFoundException} If the key/version does not exist.
   */
  async deleteVersion(
    key: string,
    version: bigint,
    userId: number,
  ): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    try {
      // TODO (DRY): variable named 'forms' should be 'planConfigs' — copy-paste error.
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

  /**
   * Soft deletes a single revision.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param revision Target revision number.
   * @param userId Audit user id.
   * @throws {NotFoundException} If the key/version/revision does not exist.
   */
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

  /**
   * Maps Prisma entity fields into API DTO fields.
   *
   * @param planConfig Prisma entity.
   * @returns Response DTO with bigint values converted to strings.
   */
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

  /**
   * Trims and validates a metadata key.
   *
   * @param key Raw key input.
   * @returns Normalized key.
   * @throws {BadRequestException} If key is empty.
   */
  private normalizeKey(key: string): string {
    const normalized = String(key || '').trim();

    if (!normalized) {
      throw new BadRequestException('Metadata key is required.');
    }

    return normalized;
  }

  /**
   * Re-throws `HttpException` and delegates non-HTTP errors to
   * `PrismaErrorService`.
   *
   * @param error Unknown error.
   * @param operation Operation label.
   * @throws {HttpException} Re-throws HTTP exceptions.
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
