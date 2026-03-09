import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CopilotOpportunityType, Prisma } from '@prisma/client';
import { Permission as NamedPermission } from 'src/shared/constants/permissions';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { normalizeEntity as normalizePrismaEntity } from 'src/shared/utils/entity.utils';

/**
 * Shared pure-function toolkit for the copilot feature.
 * Handles id parsing, request-data extraction, entity normalization,
 * role checks, sort parsing, and audit user id parsing.
 */
export type CopilotRequestDataRecord = Record<string, unknown>;

/**
 * Parses a numeric entity id from a raw string.
 *
 * @param value Raw id string value.
 * @param label Entity label used in the error message.
 * @returns Parsed bigint id.
 * @throws BadRequestException If the value is not numeric.
 */
export function parseNumericId(value: string, label: string): bigint {
  const normalized = String(value || '').trim();

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(`${label} id must be a numeric string.`);
  }

  return BigInt(normalized);
}

/**
 * Reads and safely clones the copilot request data object from Prisma JSON.
 *
 * @param value Prisma JsonValue payload.
 * @returns Safe plain-object copy of request data, or an empty object.
 */
export function getCopilotRequestData(
  value: Prisma.JsonValue | null | undefined,
): CopilotRequestDataRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }

  return {};
}

/**
 * Recursively normalizes entity values for API responses.
 */
export function normalizeEntity<T>(payload: T): T {
  return normalizePrismaEntity(payload);
}

/**
 * Converts an opportunity type enum to a human-readable label.
 *
 * @param type Copilot opportunity type.
 * @returns Human-readable type label.
 */
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

/**
 * Returns true if user is admin, project manager, or manager.
 *
 * @param user Authenticated JWT user.
 * @returns Whether the user is admin-or-manager scoped.
 */
export function isAdminOrManager(user: JwtUser): boolean {
  const userRoles = user.roles || [];

  return [
    UserRole.CONNECT_ADMIN,
    UserRole.TOPCODER_ADMIN,
    UserRole.PROJECT_MANAGER,
    UserRole.MANAGER,
  ].some((role) => userRoles.includes(role));
}

/**
 * Returns true if user is admin or project manager.
 *
 * @param user Authenticated JWT user.
 * @returns Whether the user is admin-or-pm scoped.
 */
export function isAdminOrPm(user: JwtUser): boolean {
  const userRoles = user.roles || [];

  return [
    UserRole.CONNECT_ADMIN,
    UserRole.TOPCODER_ADMIN,
    UserRole.PROJECT_MANAGER,
  ].some((role) => userRoles.includes(role));
}

/**
 * Parses a query sort expression and validates it against an allow-list.
 *
 * @param sort Raw sort query value.
 * @param allowedSorts List of allowed sort expressions.
 * @param defaultValue Default sort expression when none is provided.
 * @returns Tuple of [field, direction].
 * @throws BadRequestException If the sort expression is invalid.
 */
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

/**
 * Parses the numeric audit user id from an authenticated JWT user.
 *
 * @param user Authenticated JWT user.
 * @returns Numeric user id for audit fields, or `-1` for machine tokens that
 * do not carry a numeric user id.
 * @throws BadRequestException If a human token has a non-numeric user id.
 */
export function getAuditUserId(user: JwtUser): number {
  const value = Number.parseInt(String(user.userId || '').trim(), 10);

  if (Number.isNaN(value)) {
    if (user.isMachine) {
      return -1;
    }

    throw new BadRequestException('Authenticated user id must be numeric.');
  }

  return value;
}

/**
 * Enforces a named permission for the current user.
 *
 * @throws ForbiddenException If permission is missing.
 */
export function ensureNamedPermission(
  permissionService: PermissionService,
  permission: NamedPermission,
  user: JwtUser,
): void {
  if (!permissionService.hasNamedPermission(permission, user)) {
    throw new ForbiddenException('Insufficient permissions');
  }
}

/**
 * Reads a string-like primitive value.
 */
export function readString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return `${value}`;
  }

  return undefined;
}
