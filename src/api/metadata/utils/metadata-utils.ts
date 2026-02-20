/**
 * Shared utilities for metadata APIs:
 * - route/query parameter parsing
 * - audit user id extraction
 * - metadata reference normalization
 * - deep BigInt serialization for JSON responses
 */
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { JwtUser } from 'src/shared/modules/global/jwt.service';

export interface MetadataVersionReference {
  key: string;
  version: number;
}

/**
 * Parses a route parameter into `bigint`.
 *
 * @param value Raw route parameter value.
 * @param fieldName Parameter name used in error messages.
 * @returns Parsed bigint value.
 * @throws {BadRequestException} When value is not numeric.
 */
export function parseBigIntParam(value: string, fieldName: string): bigint {
  const normalized = String(value || '').trim();

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(`${fieldName} must be a numeric string.`);
  }

  return BigInt(normalized);
}

/**
 * Parses and validates a safe positive integer parameter.
 *
 * @param value Raw route/query value.
 * @param fieldName Parameter name used in error messages.
 * @returns Parsed safe positive integer.
 * @throws {BadRequestException} When value is not a safe positive integer.
 */
export function parsePositiveIntegerParam(
  value: string,
  fieldName: string,
): number {
  const normalized = String(value || '').trim();

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(`${fieldName} must be a positive integer.`);
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(
      `${fieldName} must be a safe positive integer.`,
    );
  }

  return parsed;
}

/**
 * Parses an optional boolean query parameter.
 *
 * Accepted values: `true`, `false`, `'true'`, `'false'`.
 *
 * @param value Raw query parameter value.
 * @returns Parsed boolean or `undefined` when absent.
 * @throws {BadRequestException} When value is not a supported boolean
 * representation.
 */
export function parseOptionalBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  throw new BadRequestException(
    'Boolean query parameter must be true or false.',
  );
}

// TODO (SECURITY): getAuditUserIdNumber and getAuditUserIdBigInt duplicate the same validation logic. Consolidate into one function and derive the other from it.
/**
 * Extracts the authenticated user id as a safe positive integer.
 *
 * @param user Authenticated JWT user payload.
 * @returns Numeric user id for audit columns typed as `number`.
 * @throws {ForbiddenException} When user id is missing, non-numeric, or outside
 * the safe integer range.
 */
export function getAuditUserIdNumber(user: JwtUser): number {
  const rawUserId = String(user.userId || '').trim();

  if (!/^\d+$/.test(rawUserId)) {
    throw new ForbiddenException('Authenticated user id must be numeric.');
  }

  const parsed = Number.parseInt(rawUserId, 10);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ForbiddenException(
      'Authenticated user id must be a safe positive integer.',
    );
  }

  return parsed;
}

/**
 * Extracts the authenticated user id as bigint.
 *
 * @param user Authenticated JWT user payload.
 * @returns BigInt user id for audit columns typed as `bigint`.
 * @throws {ForbiddenException} When user id is missing or non-numeric.
 */
export function getAuditUserIdBigInt(user: JwtUser): bigint {
  const rawUserId = String(user.userId || '').trim();

  if (!/^\d+$/.test(rawUserId)) {
    throw new ForbiddenException('Authenticated user id must be numeric.');
  }

  return BigInt(rawUserId);
}

/**
 * Normalizes JSON metadata references to a `{ key, version }` shape.
 *
 * Empty/null values resolve to `null`. Missing version resolves to `0`, which
 * callers treat as "latest".
 *
 * @param value Raw JSON payload value.
 * @param fieldName Field name used in validation messages.
 * @returns Normalized reference or `null`.
 * @throws {BadRequestException} When payload shape is invalid.
 */
export function normalizeMetadataReference(
  value: unknown,
  fieldName: string,
): MetadataVersionReference | null {
  if (typeof value === 'undefined' || value === null) {
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${fieldName} reference must be an object.`);
  }

  const reference = value as Record<string, unknown>;
  if (Object.keys(reference).length === 0) {
    return null;
  }

  const key = typeof reference.key === 'string' ? reference.key.trim() : '';

  if (!key) {
    throw new BadRequestException(`${fieldName}.key is required.`);
  }

  if (typeof reference.version === 'undefined' || reference.version === null) {
    return {
      key,
      version: 0,
    };
  }

  const parsedVersion = Number(reference.version);
  if (!Number.isInteger(parsedVersion) || parsedVersion <= 0) {
    throw new BadRequestException(
      `${fieldName}.version must be a positive integer.`,
    );
  }

  return {
    key,
    version: parsedVersion,
  };
}

/**
 * Recursively converts `bigint` values into strings for JSON-safe responses.
 *
 * @param value Any serializable value.
 * @returns Value with all nested bigint values stringified.
 */
export function toSerializable(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry): unknown => toSerializable(entry));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = toSerializable(entry);
    }
    return result;
  }

  return value;
}

/**
 * Re-throws HTTP framework errors and ignores non-HTTP errors.
 *
 * @param error Unknown thrown value.
 * @returns `void` when error is not an HttpException.
 * @throws {HttpException} Re-throws incoming HttpException instances.
 */
export function rethrowHttpError(error: unknown): void {
  if (error instanceof HttpException) {
    throw error;
  }
}
