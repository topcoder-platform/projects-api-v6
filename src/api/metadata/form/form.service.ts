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
import { FormResponseDto } from './dto/form-response.dto';

@Injectable()
export class FormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

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

    const latestByVersion = new Map<string, Form>();

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
