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
  const reference = normalizeMetadataReference(formRef, 'form');

  if (!reference) {
    return null;
  }

  if (reference.version > 0) {
    const found = await prisma.form.findFirst({
      where: {
        key: reference.key,
        version: toVersionBigInt(reference.version),
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
      select: {
        version: true,
      },
    });

    if (!found) {
      throw new BadRequestException(
        `Form not found for key ${reference.key} version ${reference.version}.`,
      );
    }

    return normalizeResolvedReference(reference, found.version);
  }

  const latest = await prisma.form.findFirst({
    where: {
      key: reference.key,
      deletedAt: null,
    },
    orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    select: {
      version: true,
    },
  });

  if (!latest) {
    throw new BadRequestException(`Form not found for key ${reference.key}.`);
  }

  return normalizeResolvedReference(reference, latest.version);
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
  const reference = normalizeMetadataReference(planConfigRef, 'planConfig');

  if (!reference) {
    return null;
  }

  if (reference.version > 0) {
    const found = await prisma.planConfig.findFirst({
      where: {
        key: reference.key,
        version: toVersionBigInt(reference.version),
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
      select: {
        version: true,
      },
    });

    if (!found) {
      throw new BadRequestException(
        `PlanConfig not found for key ${reference.key} version ${reference.version}.`,
      );
    }

    return normalizeResolvedReference(reference, found.version);
  }

  const latest = await prisma.planConfig.findFirst({
    where: {
      key: reference.key,
      deletedAt: null,
    },
    orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    select: {
      version: true,
    },
  });

  if (!latest) {
    throw new BadRequestException(
      `PlanConfig not found for key ${reference.key}.`,
    );
  }

  return normalizeResolvedReference(reference, latest.version);
}

// TODO (DRY): validateFormReference, validatePlanConfigReference, and validatePriceConfigReference are identical except for the Prisma model used. Extract a generic validateVersionedReference(ref, prismaDelegate, entityName) helper.
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
  const reference = normalizeMetadataReference(priceConfigRef, 'priceConfig');

  if (!reference) {
    return null;
  }

  if (reference.version > 0) {
    const found = await prisma.priceConfig.findFirst({
      where: {
        key: reference.key,
        version: toVersionBigInt(reference.version),
        deletedAt: null,
      },
      orderBy: [{ revision: 'desc' }],
      select: {
        version: true,
      },
    });

    if (!found) {
      throw new BadRequestException(
        `PriceConfig not found for key ${reference.key} version ${reference.version}.`,
      );
    }

    return normalizeResolvedReference(reference, found.version);
  }

  const latest = await prisma.priceConfig.findFirst({
    where: {
      key: reference.key,
      deletedAt: null,
    },
    orderBy: [{ version: 'desc' }, { revision: 'desc' }],
    select: {
      version: true,
    },
  });

  if (!latest) {
    throw new BadRequestException(
      `PriceConfig not found for key ${reference.key}.`,
    );
  }

  return normalizeResolvedReference(reference, latest.version);
}
