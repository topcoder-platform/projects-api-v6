import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Form, Prisma } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import {
  normalizeVersionedConfigKey,
  pickLatestRevisionPerVersion,
} from '../utils/versioned-config.utils';
import { FormResponseDto } from './dto/form-response.dto';

@Injectable()
/**
 * Manages versioned form configurations referenced by project and product
 * templates.
 *
 * Each form is keyed by `key` and versioned with:
 * - `version`: major version
 * - `revision`: minor revision within a version
 *
 * Soft delete is used for all delete operations.
 */
export class FormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * Fetches the latest revision from the latest version for a key.
   *
   * @param key Metadata key.
   * @returns Latest form revision DTO.
   * @throws {NotFoundException} If no form exists for the key.
   */
  async findLatestRevisionOfLatestVersion(
    key: string,
  ): Promise<FormResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const form = await this.prisma.form.findFirst({
      where: {
        key: normalizedKey,
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    if (!form) {
      throw new NotFoundException(`Form not found for key ${normalizedKey}.`);
    }

    return this.toDto(form);
  }

  /**
   * Returns one record per version (latest revision of each version).
   *
   * @param key Metadata key.
   * @returns Form DTOs, one per version.
   * @throws {NotFoundException} If no form exists for the key.
   */
  async findAllVersions(key: string): Promise<FormResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    const records = await this.prisma.form.findMany({
      where: {
        key: normalizedKey,
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    if (records.length === 0) {
      throw new NotFoundException(`Form not found for key ${normalizedKey}.`);
    }

    return pickLatestRevisionPerVersion(records).map((record) =>
      this.toDto(record),
    );
  }

  /**
   * Fetches the latest revision for a specific version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @returns Form DTO for the latest revision of the version.
   * @throws {NotFoundException} If the key/version does not exist.
   */
  async findLatestRevisionOfVersion(
    key: string,
    version: bigint,
  ): Promise<FormResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const form = await this.prisma.form.findFirst({
      where: {
        key: normalizedKey,
        version,
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
    });

    if (!form) {
      throw new NotFoundException(
        `Form not found for key ${normalizedKey} version ${version.toString()}.`,
      );
    }

    return this.toDto(form);
  }

  /**
   * Fetches all revisions for a specific version, newest first.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @returns Form revision DTOs.
   * @throws {NotFoundException} If the key/version does not exist.
   */
  async findAllRevisions(
    key: string,
    version: bigint,
  ): Promise<FormResponseDto[]> {
    const normalizedKey = this.normalizeKey(key);

    const forms = await this.prisma.form.findMany({
      where: {
        key: normalizedKey,
        version,
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
    });

    if (forms.length === 0) {
      throw new NotFoundException(
        `Form not found for key ${normalizedKey} version ${version.toString()}.`,
      );
    }

    return forms.map((form) => this.toDto(form));
  }

  /**
   * Fetches an exact key/version/revision record.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param revision Target revision number.
   * @returns Form DTO for the exact revision.
   * @throws {NotFoundException} If the exact revision does not exist.
   */
  async findSpecificRevision(
    key: string,
    version: bigint,
    revision: bigint,
  ): Promise<FormResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    const form = await this.prisma.form.findFirst({
      where: {
        key: normalizedKey,
        version,
        revision,
        deletedAt: null,
      },
    });

    if (!form) {
      throw new NotFoundException(
        `Form not found for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}.`,
      );
    }

    return this.toDto(form);
  }

  /**
   * Creates a new version for a key with revision `1`.
   *
   * @param key Metadata key.
   * @param config Form configuration payload.
   * @param userId Audit user id.
   * @returns Created form DTO.
   * @throws {BadRequestException} If key is empty.
   */
  async createVersion(
    key: string,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<FormResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.form.findFirst({
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

      const created = await this.prisma.form.create({
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
        PROJECT_METADATA_RESOURCE.FORM_VERSION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, `create form version for key ${normalizedKey}`);
    }
  }

  /**
   * Creates a new revision under an existing version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param config Form configuration payload.
   * @param userId Audit user id.
   * @returns Created form revision DTO.
   * @throws {NotFoundException} If key/version does not exist.
   * @throws {BadRequestException} If key is empty.
   */
  async createRevision(
    key: string,
    version: bigint,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<FormResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.form.findFirst({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        orderBy: [{ revision: 'desc' }],
      });

      if (!latest) {
        throw new NotFoundException(
          `Form not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      const created = await this.prisma.form.create({
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
        PROJECT_METADATA_RESOURCE.FORM_REVISION,
        created.id,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(
        error,
        `create form revision for key ${normalizedKey} version ${version.toString()}`,
      );
    }
  }

  /**
   * Updates the config on the latest revision of a specific version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param config Replacement configuration payload.
   * @param userId Audit user id.
   * @returns Updated form DTO.
   * @throws {NotFoundException} If key/version does not exist.
   */
  async updateVersion(
    key: string,
    version: bigint,
    config: Record<string, unknown>,
    userId: number,
  ): Promise<FormResponseDto> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const latest = await this.prisma.form.findFirst({
        where: {
          key: normalizedKey,
          version,
          deletedAt: null,
        },
        orderBy: [{ revision: 'desc' }],
      });

      if (!latest) {
        throw new NotFoundException(
          `Form not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      const updated = await this.prisma.form.update({
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
        PROJECT_METADATA_RESOURCE.FORM_VERSION,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(
        error,
        `update form version for key ${normalizedKey} version ${version.toString()}`,
      );
    }
  }

  /**
   * Soft deletes all revisions for a version.
   *
   * @param key Metadata key.
   * @param version Target version number.
   * @param userId Audit user id.
   * @throws {NotFoundException} If key/version does not exist.
   */
  async deleteVersion(
    key: string,
    version: bigint,
    userId: number,
  ): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const forms = await this.prisma.form.findMany({
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
          `Form not found for key ${normalizedKey} version ${version.toString()}.`,
        );
      }

      await this.prisma.form.updateMany({
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
        forms.map((form) =>
          publishMetadataEvent(
            this.eventBusService,
            'PROJECT_METADATA_DELETE',
            PROJECT_METADATA_RESOURCE.FORM_VERSION,
            form.id,
            { id: form.id.toString() },
            userId,
          ),
        ),
      );
    } catch (error) {
      this.handleError(
        error,
        `delete form version for key ${normalizedKey} version ${version.toString()}`,
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
   * @throws {NotFoundException} If key/version/revision does not exist.
   */
  async deleteRevision(
    key: string,
    version: bigint,
    revision: bigint,
    userId: number,
  ): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    try {
      const form = await this.prisma.form.findFirst({
        where: {
          key: normalizedKey,
          version,
          revision,
          deletedAt: null,
        },
      });

      if (!form) {
        throw new NotFoundException(
          `Form not found for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}.`,
        );
      }

      const deleted = await this.prisma.form.update({
        where: {
          id: form.id,
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
        PROJECT_METADATA_RESOURCE.FORM_REVISION,
        deleted.id,
        { id: deleted.id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(
        error,
        `delete form revision for key ${normalizedKey} version ${version.toString()} revision ${revision.toString()}`,
      );
    }
  }

  /**
   * Maps Prisma entity to API DTO, converting bigint fields to strings.
   *
   * @param form Prisma form entity.
   * @returns Serialized form response DTO.
   */
  private toDto(form: Form): FormResponseDto {
    return {
      id: form.id.toString(),
      key: form.key,
      version: form.version.toString(),
      revision: form.revision.toString(),
      config:
        typeof form.config === 'object' && form.config !== null
          ? (form.config as Record<string, unknown>)
          : {},
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      createdBy: form.createdBy,
      updatedBy: form.updatedBy,
    };
  }

  /**
   * Trims and validates metadata key.
   *
   * @param key Raw metadata key.
   * @returns Normalized key.
   * @throws {BadRequestException} If key is empty.
   */
  private normalizeKey(key: string): string {
    return normalizeVersionedConfigKey(key, 'Metadata');
  }

  /**
   * Re-throws framework HTTP exceptions and delegates Prisma errors to
   * `PrismaErrorService`.
   *
   * @param error Unknown error.
   * @param operation Operation name for error context.
   * @throws {HttpException} Re-throws known HTTP errors.
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
