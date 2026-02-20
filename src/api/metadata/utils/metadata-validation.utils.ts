/**
 * Validates and resolves metadata version references (form, planConfig,
 * priceConfig) against the database.
 *
 * These helpers are used during template create/update/upgrade flows to ensure
 * referenced metadata versions exist and to resolve omitted versions to the
 * latest available version.
 */
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  MetadataVersionReference,
  normalizeMetadataReference,
} from './metadata-utils';

/**
 * Converts a reference version to `bigint` for Prisma filters.
 *
 * @param version Numeric version from request payload.
 * @returns Truncated bigint version.
 */
function toVersionBigInt(version: number): bigint {
  return BigInt(Math.trunc(version));
}

/**
 * Normalizes a validated reference with the resolved persisted version.
 *
 * @param reference Reference payload.
 * @param resolvedVersion Version found in the database.
 * @returns Reference with resolved numeric version value.
 */
function normalizeResolvedReference(
  reference: MetadataVersionReference,
  resolvedVersion: bigint,
): MetadataVersionReference {
  return {
    key: reference.key,
    version: Number(resolvedVersion),
  };
}

type VersionedReferenceDelegate = {
  findFirst(args: {
    where: {
      key: string;
      version?: bigint;
      deletedAt: null;
    };
    orderBy: Array<{
      version?: 'desc';
      revision: 'desc';
    }>;
    select: {
      version: true;
    };
  }): Promise<{
    version: bigint;
  } | null>;
};

async function validateVersionedReference(
  rawReference: unknown,
  fieldName: 'form' | 'planConfig' | 'priceConfig',
  entityName: 'Form' | 'PlanConfig' | 'PriceConfig',
  delegate: VersionedReferenceDelegate,
): Promise<MetadataVersionReference | null> {
  const reference = normalizeMetadataReference(rawReference, fieldName);

  if (!reference) {
    return null;
  }

  const found = await delegate.findFirst({
    where: {
      key: reference.key,
      ...(reference.version > 0
        ? {
            version: toVersionBigInt(reference.version),
          }
        : {}),
      deletedAt: null,
    },
    orderBy:
      reference.version > 0
        ? [{ revision: 'desc' }]
        : [{ version: 'desc' }, { revision: 'desc' }],
    select: {
      version: true,
    },
  });

  if (!found) {
    if (reference.version > 0) {
      throw new BadRequestException(
        `${entityName} not found for key ${reference.key} version ${reference.version}.`,
      );
    }

    throw new BadRequestException(
      `${entityName} not found for key ${reference.key}.`,
    );
  }

  return normalizeResolvedReference(reference, found.version);
}

/**
 * Validates a form reference and resolves version `0` to the latest version.
 *
 * @param formRef Raw form reference payload.
 * @param prisma Prisma service used to validate existence.
 * @returns Resolved metadata reference or `null` when omitted.
 * @throws {BadRequestException} When the referenced form key/version is not
 * found.
 */
export async function validateFormReference(
  formRef: unknown,
  prisma: PrismaService,
): Promise<MetadataVersionReference | null> {
  return validateVersionedReference(formRef, 'form', 'Form', prisma.form);
}

/**
 * Validates a planConfig reference and resolves version `0` to the latest
 * version.
 *
 * @param planConfigRef Raw planConfig reference payload.
 * @param prisma Prisma service used to validate existence.
 * @returns Resolved metadata reference or `null` when omitted.
 * @throws {BadRequestException} When the referenced planConfig key/version is
 * not found.
 */
export async function validatePlanConfigReference(
  planConfigRef: unknown,
  prisma: PrismaService,
): Promise<MetadataVersionReference | null> {
  return validateVersionedReference(
    planConfigRef,
    'planConfig',
    'PlanConfig',
    prisma.planConfig,
  );
}
/**
 * Validates a priceConfig reference and resolves version `0` to the latest
 * version.
 *
 * @param priceConfigRef Raw priceConfig reference payload.
 * @param prisma Prisma service used to validate existence.
 * @returns Resolved metadata reference or `null` when omitted.
 * @throws {BadRequestException} When the referenced priceConfig key/version is
 * not found.
 */
export async function validatePriceConfigReference(
  priceConfigRef: unknown,
  prisma: PrismaService,
): Promise<MetadataVersionReference | null> {
  return validateVersionedReference(
    priceConfigRef,
    'priceConfig',
    'PriceConfig',
    prisma.priceConfig,
  );
}
