import { BadRequestException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import {
  MetadataVersionReference,
  normalizeMetadataReference,
} from './metadata-utils';

/**
 * Converts optional values to Prisma nullable JSON input.
 */
export function toNullableJson(
  value: Record<string, unknown> | MetadataVersionReference | null | undefined,
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
 * Parses a stored metadata reference from JSON.
 *
 * Returns `null` when reference shape is missing/invalid.
 */
export function getStoredReference(
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
export function toRecord(
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
export function mergeJson(
  current: Prisma.JsonValue | null,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const currentRecord = toRecord(current);
  return {
    ...(currentRecord || {}),
    ...next,
  };
}

/**
 * Re-throws framework HTTP exceptions and delegates unknown errors to
 * PrismaErrorService.
 */
export function handleMetadataServiceError(
  error: unknown,
  operation: string,
  prismaErrorService: PrismaErrorService,
): never {
  if (error instanceof HttpException) {
    throw error;
  }

  prismaErrorService.handleError(error, operation);
}
