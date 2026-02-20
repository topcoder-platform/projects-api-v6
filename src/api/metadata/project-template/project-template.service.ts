import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectTemplate } from '@prisma/client';
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
import {
  validateFormReference,
  validatePlanConfigReference,
  validatePriceConfigReference,
} from '../utils/metadata-validation.utils';
import { FormService } from '../form/form.service';
import { PlanConfigService } from '../plan-config/plan-config.service';
import { PriceConfigService } from '../price-config/price-config.service';
import { CreateProjectTemplateDto } from './dto/create-project-template.dto';
import { ProjectTemplateResponseDto } from './dto/project-template-response.dto';
import { UpdateProjectTemplateDto } from './dto/update-project-template.dto';
import { UpgradeProjectTemplateDto } from './dto/upgrade-project-template.dto';

@Injectable()
/**
 * Manages project templates, including legacy inline config fields and modern
 * versioned metadata references (`form`, `planConfig`, `priceConfig`).
 *
 * The `upgrade` flow migrates legacy templates into the versioned format.
 */
export class ProjectTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
    private readonly formService: FormService,
    private readonly planConfigService: PlanConfigService,
    private readonly priceConfigService: PriceConfigService,
  ) {}

  /**
   * Lists project templates, optionally including disabled entries.
   */
  async findAll(
    includeDisabled = false,
  ): Promise<ProjectTemplateResponseDto[]> {
    const records = await this.prisma.projectTemplate.findMany({
      where: {
        deletedAt: null,
        ...(includeDisabled ? {} : { disabled: false }),
      },
      orderBy: [{ id: 'asc' }],
    });

    return Promise.all(records.map((record) => this.toDto(record, false)));
  }

  /**
   * Loads one project template by id.
   */
  async findOne(id: bigint): Promise<ProjectTemplateResponseDto> {
    const template = await this.prisma.projectTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Project template not found for id ${id.toString()}.`,
      );
    }

    return this.toDto(template, true);
  }

  /**
   * Creates a project template and validates metadata references.
   */
  async create(
    dto: CreateProjectTemplateDto,
    userId: bigint,
  ): Promise<ProjectTemplateResponseDto> {
    this.validateTemplateConfigConstraints(dto);

    try {
      const form = await validateFormReference(dto.form, this.prisma);
      const planConfig = await validatePlanConfigReference(
        dto.planConfig,
        this.prisma,
      );
      const priceConfig = await validatePriceConfigReference(
        dto.priceConfig,
        this.prisma,
      );

      const created = await this.prisma.projectTemplate.create({
        data: {
          name: dto.name,
          key: dto.key,
          category: dto.category,
          subCategory: dto.subCategory,
          metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          icon: dto.icon,
          question: dto.question,
          info: dto.info,
          aliases: (dto.aliases || []) as Prisma.InputJsonValue,
          scope: this.toNullableJson(dto.scope),
          phases: this.toNullableJson(dto.phases),
          form: this.toNullableJson(form),
          planConfig: this.toNullableJson(planConfig),
          priceConfig: this.toNullableJson(priceConfig),
          disabled: dto.disabled || false,
          hidden: dto.hidden || false,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PROJECT_TEMPLATE,
        created.id,
        created,
        userId,
      );

      return this.toDto(created, true);
    } catch (error) {
      this.handleError(error, 'create project template');
    }
  }

  /**
   * Updates a project template and validates metadata references.
   */
  async update(
    id: bigint,
    dto: UpdateProjectTemplateDto,
    userId: bigint,
  ): Promise<ProjectTemplateResponseDto> {
    this.validateTemplateConfigConstraints(dto);

    try {
      const existing = await this.prisma.projectTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Project template not found for id ${id.toString()}.`,
        );
      }

      const form =
        typeof dto.form === 'undefined'
          ? undefined
          : await validateFormReference(dto.form, this.prisma);
      const planConfig =
        typeof dto.planConfig === 'undefined'
          ? undefined
          : await validatePlanConfigReference(dto.planConfig, this.prisma);
      const priceConfig =
        typeof dto.priceConfig === 'undefined'
          ? undefined
          : await validatePriceConfigReference(dto.priceConfig, this.prisma);

      const updated = await this.prisma.projectTemplate.update({
        where: {
          id,
        },
        data: {
          ...(typeof dto.name === 'undefined' ? {} : { name: dto.name }),
          ...(typeof dto.key === 'undefined' ? {} : { key: dto.key }),
          ...(typeof dto.category === 'undefined'
            ? {}
            : { category: dto.category }),
          ...(typeof dto.subCategory === 'undefined'
            ? {}
            : { subCategory: dto.subCategory }),
          ...(typeof dto.metadata === 'undefined'
            ? {}
            : { metadata: dto.metadata as Prisma.InputJsonValue }),
          ...(typeof dto.icon === 'undefined' ? {} : { icon: dto.icon }),
          ...(typeof dto.question === 'undefined'
            ? {}
            : { question: dto.question }),
          ...(typeof dto.info === 'undefined' ? {} : { info: dto.info }),
          ...(typeof dto.aliases === 'undefined'
            ? {}
            : { aliases: dto.aliases as Prisma.InputJsonValue }),
          ...(typeof dto.scope === 'undefined'
            ? {}
            : {
                scope:
                  dto.scope === null
                    ? Prisma.JsonNull
                    : (this.mergeJson(
                        existing.scope,
                        dto.scope,
                      ) as Prisma.InputJsonValue),
              }),
          ...(typeof dto.phases === 'undefined'
            ? {}
            : {
                phases:
                  dto.phases === null
                    ? Prisma.JsonNull
                    : (this.mergeJson(
                        existing.phases,
                        dto.phases,
                      ) as Prisma.InputJsonValue),
              }),
          ...(typeof form === 'undefined'
            ? {}
            : { form: this.toNullableJson(form) }),
          ...(typeof planConfig === 'undefined'
            ? {}
            : { planConfig: this.toNullableJson(planConfig) }),
          ...(typeof priceConfig === 'undefined'
            ? {}
            : { priceConfig: this.toNullableJson(priceConfig) }),
          ...(typeof dto.disabled === 'undefined'
            ? {}
            : { disabled: dto.disabled }),
          ...(typeof dto.hidden === 'undefined' ? {} : { hidden: dto.hidden }),
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PROJECT_TEMPLATE,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated, true);
    } catch (error) {
      this.handleError(error, `update project template ${id.toString()}`);
    }
  }

  /**
   * Soft deletes a project template.
   */
  async delete(id: bigint, userId: bigint): Promise<void> {
    try {
      const existing = await this.prisma.projectTemplate.findFirst({
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
          `Project template not found for id ${id.toString()}.`,
        );
      }

      await this.prisma.projectTemplate.update({
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
        PROJECT_METADATA_RESOURCE.PROJECT_TEMPLATE,
        id,
        { id: id.toString() },
        userId,
      );
    } catch (error) {
      this.handleError(error, `delete project template ${id.toString()}`);
    }
  }

  /**
   * Upgrades a legacy template to versioned metadata references.
   */
  async upgrade(
    id: bigint,
    dto: UpgradeProjectTemplateDto,
    userId: bigint,
  ): Promise<ProjectTemplateResponseDto> {
    try {
      // TODO (SECURITY): upgrade() creates form, planConfig, and priceConfig versions in separate DB calls with no wrapping transaction. A failure mid-upgrade leaves the template in a partially upgraded state. Wrap in prisma.$transaction().
      const existing = await this.prisma.projectTemplate.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Project template not found for id ${id.toString()}.`,
        );
      }

      const auditUserId = Number(userId.toString());

      const existingForm = this.getStoredReference(existing.form, 'form');
      const existingPlanConfig = this.getStoredReference(
        existing.planConfig,
        'planConfig',
      );
      const existingPriceConfig = this.getStoredReference(
        existing.priceConfig,
        'priceConfig',
      );

      const requestedForm =
        typeof dto.form === 'undefined'
          ? undefined
          : await validateFormReference(dto.form, this.prisma);
      let form =
        typeof requestedForm === 'undefined' ? existingForm : requestedForm;
      if (!form) {
        const scope = this.toRecord(existing.scope);

        if (!scope) {
          throw new BadRequestException(
            'Cannot upgrade project template: form reference is missing and legacy scope is unavailable.',
          );
        }

        const formConfig = {
          sections: scope.sections,
          wizard: scope.wizard,
          preparedConditions: scope.preparedConditions,
        };

        const createdForm = await this.formService.createVersion(
          existing.key,
          formConfig,
          auditUserId,
        );
        form = {
          key: existing.key,
          version: Number(createdForm.version),
        };
      }

      const requestedPlanConfig =
        typeof dto.planConfig === 'undefined'
          ? undefined
          : await validatePlanConfigReference(dto.planConfig, this.prisma);
      let planConfig =
        typeof requestedPlanConfig === 'undefined'
          ? existingPlanConfig
          : requestedPlanConfig;
      if (!planConfig) {
        const phases = this.toRecord(existing.phases);

        if (!phases) {
          throw new BadRequestException(
            'Cannot upgrade project template: planConfig reference is missing and legacy phases are unavailable.',
          );
        }

        const createdPlanConfig = await this.planConfigService.createVersion(
          existing.key,
          phases,
          auditUserId,
        );

        planConfig = {
          key: existing.key,
          version: Number(createdPlanConfig.version),
        };
      }

      const requestedPriceConfig =
        typeof dto.priceConfig === 'undefined'
          ? undefined
          : await validatePriceConfigReference(dto.priceConfig, this.prisma);
      let priceConfig =
        typeof requestedPriceConfig === 'undefined'
          ? existingPriceConfig
          : requestedPriceConfig;
      if (!priceConfig) {
        const scope = this.toRecord(existing.scope);

        if (!scope) {
          throw new BadRequestException(
            'Cannot upgrade project template: priceConfig reference is missing and legacy scope is unavailable.',
          );
        }

        const priceConfigPayload = Object.fromEntries(
          Object.entries(scope).filter(
            ([entryKey]) => entryKey !== 'wizard' && entryKey !== 'sections',
          ),
        );

        const createdPriceConfig = await this.priceConfigService.createVersion(
          existing.key,
          priceConfigPayload,
          auditUserId,
        );

        priceConfig = {
          key: existing.key,
          version: Number(createdPriceConfig.version),
        };
      }

      const updated = await this.prisma.projectTemplate.update({
        where: {
          id,
        },
        data: {
          scope: Prisma.JsonNull,
          phases: Prisma.JsonNull,
          form: form as unknown as Prisma.InputJsonValue,
          planConfig: planConfig as unknown as Prisma.InputJsonValue,
          priceConfig: priceConfig as unknown as Prisma.InputJsonValue,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PROJECT_TEMPLATE,
        updated.id,
        updated,
        userId,
      );

      return this.toDto(updated, true);
    } catch (error) {
      this.handleError(error, `upgrade project template ${id.toString()}`);
    }
  }

  /**
   * Maps Prisma records to API DTOs and optionally resolves full referenced
   * metadata entities.
   */
  private async toDto(
    template: ProjectTemplate,
    resolveReferences: boolean,
  ): Promise<ProjectTemplateResponseDto> {
    const form = resolveReferences
      ? await this.resolveVersionedReference(template.form, 'form')
      : (template.form as Record<string, unknown> | null);
    const planConfig = resolveReferences
      ? await this.resolveVersionedReference(template.planConfig, 'planConfig')
      : (template.planConfig as Record<string, unknown> | null);
    const priceConfig = resolveReferences
      ? await this.resolveVersionedReference(
          template.priceConfig,
          'priceConfig',
        )
      : (template.priceConfig as Record<string, unknown> | null);

    return {
      id: template.id.toString(),
      name: template.name,
      key: template.key,
      category: template.category,
      subCategory: template.subCategory,
      metadata: toSerializable(template.metadata || {}) as Record<
        string,
        unknown
      >,
      icon: template.icon,
      question: template.question,
      info: template.info,
      aliases: toSerializable(template.aliases || []) as unknown[],
      scope: toSerializable(template.scope) as Record<string, unknown> | null,
      phases: toSerializable(template.phases) as Record<string, unknown> | null,
      form: toSerializable(form) as Record<string, unknown> | null,
      planConfig: toSerializable(planConfig) as Record<string, unknown> | null,
      priceConfig: toSerializable(priceConfig) as Record<
        string,
        unknown
      > | null,
      disabled: template.disabled,
      hidden: template.hidden,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      createdBy: template.createdBy.toString(),
      updatedBy: template.updatedBy.toString(),
    };
  }

  // TODO (DRY): resolveVersionedReference has three near-identical branches for form/planConfig/priceConfig. Extract a generic resolveReference(key, version, prismaDelegate) helper.
  /**
   * Resolves a stored metadata reference into the latest matching versioned
   * config record.
   */
  private async resolveVersionedReference(
    value: Prisma.JsonValue | null,
    type: 'form' | 'planConfig' | 'priceConfig',
  ): Promise<Record<string, unknown> | null> {
    if (!value) {
      return null;
    }

    const reference = normalizeMetadataReference(value, type);

    if (!reference) {
      return null;
    }

    if (type === 'form') {
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

    if (type === 'planConfig') {
      const latest = await this.prisma.planConfig.findFirst({
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

    const latest = await this.prisma.priceConfig.findFirst({
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

  // TODO (DRY): toRecord, mergeJson, toNullableJson, getStoredReference are duplicated in ProductTemplateService. Move to a shared metadata-template.utils.ts file.
  /**
   * Converts optional values to a Prisma nullable JSON payload.
   */
  private toNullableJson(
    value:
      | MetadataVersionReference
      | Record<string, unknown>
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
   * Reads and normalizes a stored metadata reference from JSON.
   */
  private getStoredReference(
    value: Prisma.JsonValue | null,
    type: 'form' | 'planConfig' | 'priceConfig',
  ): MetadataVersionReference | null {
    try {
      return normalizeMetadataReference(value, type);
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
    dto: CreateProjectTemplateDto | UpdateProjectTemplateDto,
  ): void {
    if (dto.form && dto.scope) {
      throw new BadRequestException(
        'Only one of form or scope may be provided.',
      );
    }

    if (dto.phases && dto.planConfig) {
      throw new BadRequestException(
        'Only one of phases or planConfig may be provided.',
      );
    }

    if (dto.priceConfig && dto.scope) {
      throw new BadRequestException(
        'priceConfig cannot be used together with scope.',
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
