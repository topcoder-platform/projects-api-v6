import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  MetadataVersionReference,
  normalizeMetadataReference,
} from './metadata-utils';

function toVersionBigInt(version: number): bigint {
  return BigInt(Math.trunc(version));
}

function normalizeResolvedReference(
  reference: MetadataVersionReference,
  resolvedVersion: bigint,
): MetadataVersionReference {
  return {
    key: reference.key,
    version: Number(resolvedVersion),
  };
}

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
