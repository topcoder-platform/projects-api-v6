import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectMemberRole } from '@prisma/client';
import { Permission } from 'src/shared/constants/permissions';
import {
  ProjectPermissionContext,
  ProjectPermissionContextBase,
  ProjectPermissionMember,
} from 'src/shared/interfaces/project-permission-context.interface';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { hasAdminRole } from 'src/shared/utils/permission.utils';

/**
 * Parses an id using `BigInt(...)` semantics and throws on invalid input.
 */
export function parseBigIntId(value: string, entityName: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException(`${entityName} id is invalid.`);
  }
}

/**
 * Parses a strictly numeric-string id (`/^[0-9]+$/`) as bigint.
 */
export function parseNumericStringId(value: string, fieldName: string): bigint {
  const normalized = String(value || '').trim();

  if (!/^\d+$/.test(normalized)) {
    throw new BadRequestException(`${fieldName} must be a numeric string.`);
  }

  return BigInt(normalized);
}

/**
 * Parses an optional id-like value as bigint.
 *
 * Returns `null` for missing or non-numeric values.
 */
export function parseOptionalNumericStringId(
  value: string | number | bigint | null | undefined,
): bigint | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return BigInt(normalized);
}

/**
 * Determines whether the authenticated principal is a machine token.
 */
export function isMachinePrincipal(user: JwtUser): boolean {
  if (user?.isMachine) {
    return true;
  }

  if (!user?.tokenPayload) {
    return false;
  }

  const grantType = user.tokenPayload.gty;
  if (
    typeof grantType === 'string' &&
    grantType.trim().toLowerCase() === 'client-credentials'
  ) {
    return true;
  }

  const rawScopes = user.tokenPayload.scope ?? user.tokenPayload.scopes;

  if (typeof rawScopes === 'string') {
    return rawScopes.trim().length > 0;
  }

  if (Array.isArray(rawScopes)) {
    return rawScopes.some((scope) => String(scope).trim().length > 0);
  }

  return false;
}

/**
 * Resolves a stable machine-principal identifier from token claims.
 */
export function getMachineActorId(user: JwtUser): string | undefined {
  if (!isMachinePrincipal(user) || !user?.tokenPayload) {
    return undefined;
  }

  for (const key of ['sub', 'azp', 'client_id', 'clientId']) {
    const value = user.tokenPayload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

/**
 * Resolves the authenticated user id as a trimmed string.
 */
export function getActorUserId(user: JwtUser): string {
  if (!user?.userId || String(user.userId).trim().length === 0) {
    const machineActorId = getMachineActorId(user);
    if (machineActorId) {
      return machineActorId;
    }

    throw new ForbiddenException('Authenticated user id is missing.');
  }

  return String(user.userId).trim();
}

/**
 * Resolves the authenticated user id as a numeric audit id.
 *
 * Returns `-1` for machine principals without a numeric actor id.
 */
export function getAuditUserId(user: JwtUser): number {
  const parsedUserId = Number.parseInt(getActorUserId(user), 10);

  if (Number.isNaN(parsedUserId)) {
    if (isMachinePrincipal(user)) {
      return -1;
    }

    throw new ForbiddenException('Authenticated user id must be numeric.');
  }

  return parsedUserId;
}

/**
 * Resolves the authenticated user id as an audit id, with fallback.
 *
 * Uses the machine-principal actor id when a human `userId` is absent.
 */
export function getAuditUserIdOrDefault(user: JwtUser, fallback = -1): number {
  const actorId =
    user?.userId && String(user.userId).trim().length > 0
      ? String(user.userId).trim()
      : (getMachineActorId(user) ?? '');
  const userId = Number.parseInt(actorId, 10);

  if (Number.isNaN(userId)) {
    return fallback;
  }

  return userId;
}

/**
 * Parses CSV fields from string or string[] input.
 */
export function parseCsvFields(fields?: string | string[]): string[] {
  if (!fields) {
    return [];
  }

  if (Array.isArray(fields)) {
    return fields
      .map((field) => String(field).trim())
      .filter((field) => field.length > 0);
  }

  if (fields.trim().length === 0) {
    return [];
  }

  return fields
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0);
}

/**
 * Normalizes unknown JSON-like values into plain object payloads.
 */
export function toDetailsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

/**
 * Converts arbitrary values to Prisma JSON input semantics.
 */
export function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

/**
 * Checks if a user is an admin for project-member scoped operations.
 */
export function isAdminProjectUser(
  permissionService: PermissionService,
  user: JwtUser,
  projectMembers: ProjectPermissionMember[],
): boolean {
  return (
    hasAdminRole(user) ||
    permissionService.hasNamedPermission(
      Permission.READ_PROJECT_ANY,
      user,
      projectMembers,
    )
  );
}

/**
 * Enforces a named permission against project members.
 */
export function ensureProjectNamedPermission(
  permissionService: PermissionService,
  permission: Permission,
  user: JwtUser,
  projectMembers: ProjectPermissionMember[],
): void {
  const hasPermission = permissionService.hasNamedPermission(
    permission,
    user,
    projectMembers,
  );

  if (!hasPermission) {
    throw new ForbiddenException('Insufficient permissions');
  }
}

type RolePermissionRule = {
  permission: Permission;
  message: string;
};

/**
 * Enforces role-specific permission rules with a default fallback rule.
 */
export function ensureRoleScopedPermission(
  permissionService: PermissionService,
  role: ProjectMemberRole,
  user: JwtUser,
  projectMembers: ProjectPermissionMember[],
  defaultRule: RolePermissionRule,
  roleRules: Partial<Record<ProjectMemberRole, RolePermissionRule>>,
): void {
  const rule = roleRules[role] || defaultRule;

  if (
    !permissionService.hasNamedPermission(rule.permission, user, projectMembers)
  ) {
    throw new ForbiddenException(rule.message);
  }
}

/**
 * Loads full project permission context (including direct/billing ids).
 */
export async function loadProjectPermissionContext(
  prisma: PrismaService,
  projectId: bigint,
): Promise<ProjectPermissionContext> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      directProjectId: true,
      billingAccountId: true,
      members: {
        where: {
          deletedAt: null,
        },
        select: {
          userId: true,
          role: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundException(`Project with id ${projectId} was not found.`);
  }

  return project;
}

/**
 * Loads base project permission context.
 */
export async function loadProjectPermissionContextBase(
  prisma: PrismaService,
  projectId: bigint,
): Promise<ProjectPermissionContextBase> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
    },
    select: {
      id: true,
      members: {
        where: {
          deletedAt: null,
        },
        select: {
          userId: true,
          role: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundException(`Project with id ${projectId} was not found.`);
  }

  return project;
}
