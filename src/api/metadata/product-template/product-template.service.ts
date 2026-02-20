import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductTemplate } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import {
  MetadataVersionReference,
  normalizeMetadataReference,
  parseBigIntParam,
  toSerializable,
} from '../utils/metadata-utils';
import { validateFormReference } from '../utils/metadata-validation.utils';
import { FormService } from '../form/form.service';
import { CreateProductTemplateDto } from './dto/create-product-template.dto';
import { ProductTemplateResponseDto } from './dto/product-template-response.dto';
import { UpdateProductTemplateDto } from './dto/update-product-template.dto';
import { UpgradeProductTemplateDto } from './dto/upgrade-product-template.dto';

@Injectable()
/**
 * Manages product templates used for work products within a project.
 *
 * Supports both legacy inline `template` JSON and modern versioned `form`
 * references. The `upgrade` operation migrates legacy templates.
 */
export class ProductTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
    private readonly formService: FormService,
  ) {}

  /**
   * Lists product templates, optionally including disabled entries.
   */
  async findAll(
    includeDisabled = false,
  ): Promise<ProductTemplateResponseDto[]> {
    const records = await this.prisma.productTemplate.findMany({
      where: {
        deletedAt: null,
        ...(includeDisabled ? {} : { disabled: false }),
      },
      orderBy: [{ id: 'asc' }],
    });

    return Promise.all(records.map((record) => this.toDto(record, false)));
  }

  /**
   * Loads one product template by id.
   */
  async findOne(id: bigint): Promise<ProductTemplateResponseDto> {
    const template = await this.prisma.productTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Product template not found for id ${id.toString()}.`,
      );
    }

    return this.toDto(template, true);
  }

  /**
   * Creates a product template and validates the optional form reference.
   */
  async create(
    dto: CreateProductTemplateDto,
    userId: bigint,
  ): Promise<ProductTemplateResponseDto> {
    this.validateTemplateConfigConstraints(dto);

    try {
      const form = await validateFormReference(dto.form, this.prisma);

      const created = await this.prisma.productTemplate.create({
        data: {
          name: dto.name,
          productKey: dto.productKey,
          category: dto.category,
          subCategory: dto.subCategory,
          icon: dto.icon,
          brief: dto.brief,
          details: dto.details,
          aliases: (dto.aliases || []) as Prisma.InputJsonValue,
          template: this.toNullableJson(dto.template),
          form: this.toNullableJson(form),
          disabled: dto.disabled || false,
          hidden: dto.hidden || false,
          isAddOn: dto.isAddOn || false,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PRODUCT_TEMPLATE,
        created.id,
        created,
        userId,
      );

      return this.toDto(created, true);
    } catch (error) {
      this.handleError(error, 'create product template');
    }
  }

  /**
   * Updates a product template and validates the optional form reference.
   */
  async update(
    id: bigint,
    dto: UpdateProductTemplateDto,
    userId: bigint,
  ): Promise<ProductTemplateResponseDto> {
    this.validateTemplateConfigConstraints(dto);

    try {
      const existing = await this.prisma.productTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Product template not found for id ${id.toString()}.`,
        );
      }

      const form =
        typeof dto.form === 'undefined'
          ? undefined
          : await validateFormReference(dto.form, this.prisma);

      const updated = await this.prisma.productTemplate.update({
        where: {
          id,
        },
        data: {
          ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
          ...(typeof dto.productKey === 'undefined'
            ? {}
            : { productKey: dto.productKey }),
          ...(typeof dto.category === 'undefined'
            ? {}
            : { category: dto.category }),
          ...(typeof dto.subCategory === 'undefined'
            ? {}
            : { subCategory: dto.subCategory }),
          ...(typeof dto.icon === 'undefined' ? {} : { icon: dto.icon }),
          ...(typeof dto.brief === 'undefined' ? {} : { brief: dto.brief }),
          ...(typeof dto.details === 'undefined'
            ? {}
            : { details: dto.details }),
          ...(typeof dto.aliases === 'undefined'
            ? {}
            : { aliases: dto.aliases as Prisma.InputJsonValue }),
          ...(typeof dto.template === 'undefined'
            ? {}
            : {
                template:
                  dto.template === null
                    ? Prisma.JsonNull
                    : (this.mergeJson(
                        existing.template,
                        dto.template,
                      ) as Prisma.InputJsonValue),
              }),
          ...(typeof form === 'undefined'
            ? {}
            : { form: this.toNullableJson(form) }),
          ...(typeof dto.disabled === 'undefined'
            ? {}
            : { disabled: dto.disabled }),
          ...(typeof dto.hidden === 'undefined' ? {} : { hidden: dto.hidden }),
          ...(typeof dto.isAddOn === 'undefined'
            ? {}
            : { isAddOn: dto.isAddOn }),
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PRODUCT_TEMPLATE,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated, true);
    } catch (error) {
      this.handleError(error, `update product template ${id.toString()}`);
    }
  }

  /**
   * Soft deletes a product template.
   */
  async delete(id: bigint, userId: bigint): Promise<void> {
    try {
      const existing = await this.prisma.productTemplate.findFirst({
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
          `Product template not found for id ${id.toString()}.`,
        );
      }

      await this.prisma.productTemplate.update({
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
        PROJECT_METADATA_RESOURCE.PRODUCT_TEMPLATE,
        id,
        { id: id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(error, `delete product template ${id.toString()}`);
    }
  }

  /**
   * Upgrades a legacy product template to use a versioned form reference.
   */
  async upgrade(
    id: bigint,
    dto: UpgradeProductTemplateDto,
    userId: bigint,
  ): Promise<ProductTemplateResponseDto> {
    try {
      const existing = await this.prisma.productTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Product template not found for id ${id.toString()}.`,
        );
      }

      const auditUserId = Number(userId.toString());

      const existingForm = this.getStoredFormReference(existing.form);
      const requestedForm =
        typeof dto.form === 'undefined'
          ? undefined
          : await validateFormReference(dto.form, this.prisma);
      let form =
        typeof requestedForm === 'undefined' ? existingForm : requestedForm;
      if (!form) {
        const template = this.toRecord(existing.template);

        if (!template) {
          throw new BadRequestException(
            'Cannot upgrade product template: form reference is missing and legacy template is unavailable.',
          );
        }

        const createdForm = await this.formService.createVersion(
          existing.productKey,
          template,
          auditUserId,
        );

        form = {
          key: existing.productKey,
          version: Number(createdForm.version),
        };
      }

      const updated = await this.prisma.productTemplate.update({
        where: {
          id,
        },
        data: {
          template: Prisma.JsonNull,
          form: form as unknown as Prisma.InputJsonValue,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PRODUCT_TEMPLATE,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated, true);
    } catch (error) {
      this.handleError(error, `upgrade product template ${id.toString()}`);
    }
  }

  /**
   * Maps Prisma records to API DTOs and optionally resolves full form details.
   */
  private async toDto(
    template: ProductTemplate,
    resolveForm: boolean,
  ): Promise<ProductTemplateResponseDto> {
    const form = resolveForm
      ? await this.resolveFormReference(template.form)
      : (template.form as Record<string, unknown> | null);

    return {
      id: template.id.toString(),
      name: template.name,
      productKey: template.productKey,
      category: template.category,
      subCategory: template.subCategory,
      icon: template.icon,
      brief: template.brief,
      details: template.details,
      aliases: toSerializable(template.aliases || []) as unknown[],
      template: toSerializable(template.template) as Record<
        string,
        unknown
      > | null,
      form: toSerializable(form) as Record<string, unknown> | null,
      disabled: template.disabled,
      hidden: template.hidden,
      isAddOn: template.isAddOn,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      createdBy: template.createdBy.toString(),
      updatedBy: template.updatedBy.toString(),
    };
  }

  /**
   * Resolves the stored form reference into the latest matching form record.
   */
  private async resolveFormReference(
    value: Prisma.JsonValue | null,
  ): Promise<Record<string, unknown> | null> {
    if (!value) {
      return null;
    }

    const reference = normalizeMetadataReference(value, 'form');
    if (!reference) {
      return null;
    }

    const latest = await this.prisma.form.findFirst({
      where: {
        key: reference.key,
        ...(reference.version > 0
          ? { version: BigInt(reference.version) }
          : {}),
        deletedAt: null,
      },
      orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    });

    return latest
      ? {
          id: latest.id.toString(),
          key: latest.key,
          version: latest.version.toString(),
          revision: latest.revision.toString(),
          config: toSerializable(latest.config || {}) as Record<
            string,
            unknown
          >,
        }
      : null;
  }

  // TODO (DRY): toRecord, mergeJson, toNullableJson, getStoredFormReference are duplicated in ProjectTemplateService. Move to a shared metadata-template.utils.ts file.
  /**
   * Converts optional values to a Prisma nullable JSON payload.
   */
  private toNullableJson(
    value:
      | Record<string, unknown>
      | MetadataVersionReference
      | null
      | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  /**
   * Reads and normalizes a stored form reference from JSON.
   */
  private getStoredFormReference(
    value: Prisma.JsonValue | null,
  ): MetadataVersionReference | null {
    try {
      return normalizeMetadataReference(value, 'form');
    } catch (error) {
      if (error instanceof BadRequestException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Converts JSON values to plain object maps when possible.
   */
  private toRecord(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  /**
   * Merges incoming JSON fields over existing object values.
   */
  private mergeJson(
    current: Prisma.JsonValue | null,
    next: Record<string, unknown>,
  ): Record<string, unknown> {
    const currentRecord = this.toRecord(current);
    return {
      ...(currentRecord || {}),
      ...next,
    };
  }

  /**
   * Validates mutually exclusive legacy and versioned config fields.
   */
  private validateTemplateConfigConstraints(
    dto: CreateProductTemplateDto | UpdateProductTemplateDto,
  ): void {
    if (dto.form && dto.template) {
      throw new BadRequestException(
        'Only one of form or template may be provided.',
      );
    }
  }

  /**
   * Parses a template id route parameter.
   */
  parseTemplateId(templateId: string): bigint {
    return parseBigIntParam(templateId, 'templateId');
  }

  // TODO (DRY): handleError is duplicated across all metadata services. Consider a shared base class or utility.
  /**
   * Re-throws framework HTTP exceptions and delegates unexpected errors to
   * PrismaErrorService.
   */
  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
