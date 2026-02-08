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

export function parseBigIntParam(value: string, fieldName: string): bigint {
  const normalized = String(value || '').trim();

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(`${fieldName} must be a numeric string.`);
  }

  return BigInt(normalized);
}

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

export function getAuditUserIdBigInt(user: JwtUser): bigint {
  const rawUserId = String(user.userId || '').trim();

  if (!/^\d+$/.test(rawUserId)) {
    throw new ForbiddenException('Authenticated user id must be numeric.');
  }

  return BigInt(rawUserId);
}

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

export function rethrowHttpError(error: unknown): void {
  if (error instanceof HttpException) {
    throw error;
  }
}
