import { Injectable } from '@nestjs/common';
import { Prisma, ProductTemplate, ProjectTemplate } from '@prisma/client';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  MetadataVersionReference,
  normalizeMetadataReference,
  toSerializable,
} from './utils/metadata-utils';

export interface MetadataListResponse {
  projectTemplates: Record<string, unknown>[];
  productTemplates: Record<string, unknown>[];
  projectTypes: Record<string, unknown>[];
  productCategories: Record<string, unknown>[];
  milestoneTemplates: Record<string, unknown>[];
  forms: Record<string, unknown>[];
  planConfigs: Record<string, unknown>[];
  priceConfigs: Record<string, unknown>[];
}

interface UsedVersionsMap {
  form: Map<string, Set<number>>;
  planConfig: Map<string, Set<number>>;
  priceConfig: Map<string, Set<number>>;
}

@Injectable()
/**
 * Orchestrates metadata list assembly by querying each metadata table in
 * parallel and applying version-selection logic for versioned resources
 * (`form`, `planConfig`, and `priceConfig`).
 */
export class MetadataListService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads all active metadata and applies the requested version-selection
   * strategy for versioned config resources.
   *
   * @param includeAllReferred Whether template-referenced versions should be
   * included along with the latest version per key.
   * @returns Metadata grouped by resource type.
   */
  async getAllMetadata(
    includeAllReferred: boolean,
  ): Promise<MetadataListResponse> {
    const [
      projectTemplates,
      productTemplates,
      projectTypes,
      productCategories,
      milestoneTemplates,
    ] = await Promise.all([
      this.prisma.projectTemplate.findMany({
        where: {
          deletedAt: null,
          disabled: false,
        },
        orderBy: [{ id: 'asc' }],
      }),
      this.prisma.productTemplate.findMany({
        where: {
          deletedAt: null,
          disabled: false,
        },
        orderBy: [{ id: 'asc' }],
      }),
      this.prisma.projectType.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }],
      }),
      this.prisma.productCategory.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }],
      }),
      this.prisma.milestoneTemplate.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [
          { reference: 'asc' },
          { referenceId: 'asc' },
          { order: 'asc' },
        ],
      }),
    ]);

    const usedVersions = this.getUsedVersions(
      projectTemplates,
      productTemplates,
    );

    const [forms, planConfigs, priceConfigs] = includeAllReferred
      ? await this.getLatestVersionIncludeUsed(usedVersions)
      : await this.getLatestVersions();

    return {
      projectTemplates: toSerializable(projectTemplates) as Record<
        string,
        unknown
      >[],
      productTemplates: toSerializable(productTemplates) as Record<
        string,
        unknown
      >[],
      projectTypes: toSerializable(projectTypes) as Record<string, unknown>[],
      productCategories: toSerializable(productCategories) as Record<
        string,
        unknown
      >[],
      milestoneTemplates: toSerializable(milestoneTemplates) as Record<
        string,
        unknown
      >[],
      forms,
      planConfigs,
      priceConfigs,
    };
  }

  /**
   * Scans template-level metadata references and returns a map of
   * `key -> used versions` for form/plan/price configs.
   *
   * @param projectTemplates Active project templates.
   * @param productTemplates Active product templates.
   * @returns Used version lookup map by metadata type.
   */
  getUsedVersions(
    projectTemplates: ProjectTemplate[],
    productTemplates: ProductTemplate[],
  ): UsedVersionsMap {
    const modelUsed: UsedVersionsMap = {
      form: new Map<string, Set<number>>(),
      planConfig: new Map<string, Set<number>>(),
      priceConfig: new Map<string, Set<number>>(),
    };

    for (const template of projectTemplates) {
      this.pushReference(modelUsed.form, template.form, 'form');
      this.pushReference(
        modelUsed.planConfig,
        template.planConfig,
        'planConfig',
      );
      this.pushReference(
        modelUsed.priceConfig,
        template.priceConfig,
        'priceConfig',
      );
    }

    for (const template of productTemplates) {
      this.pushReference(modelUsed.form, template.form, 'form');
    }

    return modelUsed;
  }

  /**
   * Returns only the latest version per key for versioned metadata resources.
   *
   * @returns Tuple of `[forms, planConfigs, priceConfigs]`, each containing one
   * latest revision record per key.
   */
  async getLatestVersions(): Promise<
    [
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ]
  > {
    // TODO (DRY): getLatestVersions and getLatestVersionIncludeUsed execute identical Prisma queries; extract the three findMany calls into a private fetchAllVersionedRecords() helper.
    const [forms, planConfigs, priceConfigs] = await Promise.all([
      this.prisma.form.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }, { version: 'desc' }, { revision: 'desc' }],
      }),
      this.prisma.planConfig.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }, { version: 'desc' }, { revision: 'desc' }],
      }),
      this.prisma.priceConfig.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }, { version: 'desc' }, { revision: 'desc' }],
      }),
    ]);

    return [
      this.pickLatestKeyVersions(forms),
      this.pickLatestKeyVersions(planConfigs),
      this.pickLatestKeyVersions(priceConfigs),
    ];
  }

  /**
   * Returns the latest version per key plus additional versions explicitly
   * referenced by active templates.
   *
   * @param usedVersions Precomputed used-version sets by metadata type.
   * @returns Tuple of `[forms, planConfigs, priceConfigs]` containing latest and
   * template-referenced versions.
   */
  async getLatestVersionIncludeUsed(
    usedVersions: UsedVersionsMap,
  ): Promise<
    [
      Record<string, unknown>[],
      Record<string, unknown>[],
      Record<string, unknown>[],
    ]
  > {
    // TODO (DRY): getLatestVersions and getLatestVersionIncludeUsed execute identical Prisma queries; extract the three findMany calls into a private fetchAllVersionedRecords() helper.
    const [forms, planConfigs, priceConfigs] = await Promise.all([
      this.prisma.form.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }, { version: 'desc' }, { revision: 'desc' }],
      }),
      this.prisma.planConfig.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }, { version: 'desc' }, { revision: 'desc' }],
      }),
      this.prisma.priceConfig.findMany({
        where: {
          deletedAt: null,
        },
        orderBy: [{ key: 'asc' }, { version: 'desc' }, { revision: 'desc' }],
      }),
    ]);

    return [
      this.pickLatestAndUsedVersions(forms, usedVersions.form),
      this.pickLatestAndUsedVersions(planConfigs, usedVersions.planConfig),
      this.pickLatestAndUsedVersions(priceConfigs, usedVersions.priceConfig),
    ];
  }

  /**
   * Parses a template JSON reference field and stores the referenced version in
   * a destination version map.
   *
   * @param destination Target map keyed by metadata key.
   * @param value Raw Prisma JSON value from template record.
   * @param name Metadata reference field name.
   */
  private pushReference(
    destination: Map<string, Set<number>>,
    value: Prisma.JsonValue | null,
    name: 'form' | 'planConfig' | 'priceConfig',
  ): void {
    const reference = normalizeMetadataReference(value, name);
    if (!reference) {
      return;
    }

    this.pushUsedVersion(destination, reference);
  }

  /**
   * Adds a resolved metadata reference version to a destination map.
   *
   * @param destination Target map keyed by metadata key.
   * @param reference Normalized metadata reference.
   */
  private pushUsedVersion(
    destination: Map<string, Set<number>>,
    reference: MetadataVersionReference,
  ): void {
    if (reference.version <= 0) {
      return;
    }

    if (!destination.has(reference.key)) {
      destination.set(reference.key, new Set<number>());
    }

    destination.get(reference.key)?.add(reference.version);
  }

  /**
   * Picks one record per key from pre-sorted records (latest version/revision
   * first) and serializes BigInt fields for JSON response output.
   *
   * @param records Sorted versioned metadata records.
   * @returns Serialized latest record per key.
   */
  private pickLatestKeyVersions<
    T extends { key: string; version: bigint; revision: bigint },
  >(records: T[]): Record<string, unknown>[] {
    const latestByKey = new Map<string, T>();

    for (const record of records) {
      if (!latestByKey.has(record.key)) {
        latestByKey.set(record.key, record);
      }
    }

    return Array.from(latestByKey.values()).map(
      (record) => toSerializable(record) as Record<string, unknown>,
    );
  }

  /**
   * Picks latest revision records for all versions included in the
   * `usedVersions` map and ensures each key's latest version is always present.
   *
   * @param records Sorted versioned metadata records.
   * @param usedVersions Version sets keyed by metadata key.
   * @returns Serialized records containing latest + referenced versions.
   */
  private pickLatestAndUsedVersions<
    T extends { key: string; version: bigint; revision: bigint },
  >(
    records: T[],
    usedVersions: Map<string, Set<number>>,
  ): Record<string, unknown>[] {
    const latestPerKey = new Map<string, T>();
    const latestPerKeyVersion = new Map<string, T>();

    for (const record of records) {
      const keyVersion = `${record.key}::${record.version.toString()}`;

      if (!latestPerKey.has(record.key)) {
        latestPerKey.set(record.key, record);
      }

      if (!latestPerKeyVersion.has(keyVersion)) {
        latestPerKeyVersion.set(keyVersion, record);
      }
    }

    for (const [key, latestRecord] of latestPerKey.entries()) {
      if (!usedVersions.has(key)) {
        usedVersions.set(key, new Set<number>());
      }

      usedVersions
        .get(key)
        ?.add(Number.parseInt(latestRecord.version.toString(), 10));
    }

    const result: T[] = [];

    for (const [key, versions] of usedVersions.entries()) {
      for (const version of versions) {
        const keyVersion = `${key}::${version}`;
        const record = latestPerKeyVersion.get(keyVersion);
        if (record) {
          result.push(record);
        }
      }
    }

    return result.map(
      (record) => toSerializable(record) as Record<string, unknown>,
    );
  }
}
