import { BadRequestException } from '@nestjs/common';
import { CopilotOpportunityType, Prisma } from '@prisma/client';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';

export type CopilotRequestDataRecord = Record<string, unknown>;

export function parseNumericId(value: string, label: string): bigint {
  const normalized = String(value || '').trim();

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(`${label} id must be a numeric string.`);
  }

  return BigInt(normalized);
}

export function getCopilotRequestData(
  value: Prisma.JsonValue | null | undefined,
): CopilotRequestDataRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
}

export function normalizeEntity<T>(payload: T): T {
  const walk = (input: unknown): unknown => {
    if (typeof input === 'bigint') {
      return input.toString();
    }

    if (input instanceof Prisma.Decimal) {
      return Number(input.toString());
    }

    if (Array.isArray(input)) {
      return input.map((entry) => walk(entry));
    }

    if (input && typeof input === 'object') {
      if (input instanceof Date) {
        return input;
      }

      const output: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        output[key] = walk(value);
      }

      return output;
    }

    return input;
  };

  return walk(payload) as T;
}

export function getCopilotTypeLabel(type: CopilotOpportunityType): string {
  switch (type) {
    case CopilotOpportunityType.dev:
      return 'Development';
    case CopilotOpportunityType.qa:
      return 'Quality Assurance';
    case CopilotOpportunityType.design:
      return 'Design';
    case CopilotOpportunityType.ai:
      return 'AI';
    case CopilotOpportunityType.datascience:
      return 'Data Science';
    default:
      return 'Quality Assurance';
  }
}

export function isAdminOrManager(user: JwtUser): boolean {
  const userRoles = user.roles || [];

  return [
    UserRole.CONNECT_ADMIN,
    UserRole.TOPCODER_ADMIN,
    UserRole.PROJECT_MANAGER,
    UserRole.MANAGER,
  ].some((role) => userRoles.includes(role));
}

export function isAdminOrPm(user: JwtUser): boolean {
  const userRoles = user.roles || [];

  return [
    UserRole.CONNECT_ADMIN,
    UserRole.TOPCODER_ADMIN,
    UserRole.PROJECT_MANAGER,
  ].some((role) => userRoles.includes(role));
}

export function parseSortExpression(
  sort: string | undefined,
  allowedSorts: string[],
  defaultValue: string,
): [string, 'asc' | 'desc'] {
  let normalized = sort ? decodeURIComponent(sort) : defaultValue;

  if (!normalized.includes(' ')) {
    normalized = `${normalized} asc`;
  }

  if (!allowedSorts.includes(normalized)) {
    throw new BadRequestException('Invalid sort criteria');
  }

  const [field, direction] = normalized.split(/\s+/);

  return [field, direction.toLowerCase() === 'asc' ? 'asc' : 'desc'];
}

export function getAuditUserId(user: JwtUser): number {
  const value = Number.parseInt(String(user.userId || '').trim(), 10);

  if (Number.isNaN(value)) {
    throw new BadRequestException('Authenticated user id must be numeric.');
  }

  return value;
}
