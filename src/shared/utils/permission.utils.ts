import { auth, Principal } from 'tc-core-library-js';
/**
 * Stateless helper functions for common permission checks.
 *
 * Used across guards and services for role/scope/member assertions.
 */
import { ProjectMember } from '../interfaces/permission.interface';
import { JwtUser } from '../modules/global/jwt.service';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, UserRole } from '../enums/userRole.enum';

/**
 * Normalizes role values for case-insensitive comparisons.
 *
 * @todo Duplicate normalization helper also exists in `member.utils.ts`,
 * `project.utils.ts`, and `permission.service.ts`. Extract a shared
 * `src/shared/utils/string.utils.ts` helper.
 */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns `true` when any requested role exists in `user.roles`.
 *
 * Comparison is case-insensitive.
 */
export function hasRoles(user: JwtUser, roles: string[]): boolean {
  const userRoles = (user.roles || []).map(normalize);
  const normalizedRoles = roles.map(normalize);

  return normalizedRoles.some((role) => userRoles.includes(role));
}

/**
 * Returns `true` if the user has an admin role or admin-equivalent scope.
 *
 * @param user Verified principal from the common validator.
 * @returns Admin access based on member roles or exact service scopes; does not throw.
 * Accepted scope overrides:
 * - `all:connect_project`
 * - `all:project` (legacy alias)
 */
export function hasAdminRole(user: JwtUser): boolean {
  return (
    (!user.isMachine && hasRoles(user, ADMIN_ROLES)) ||
    auth.hasScopes(
      user as unknown as Principal,
      [Scope.CONNECT_PROJECT_ADMIN, Scope.CONNECT_PROJECT_ADMIN_ALIAS],
      'any',
    )
  );
}

/**
 * Returns `true` when user has `UserRole.PROJECT_MANAGER`.
 */
export function hasProjectManagerRole(user: JwtUser): boolean {
  return hasRoles(user, [UserRole.PROJECT_MANAGER]);
}

/**
 * Returns `true` when `userId` is present in project members.
 */
export function isProjectMember(
  userId: string,
  projectMembers: ProjectMember[],
): boolean {
  return projectMembers.some(
    (projectMember) =>
      String(projectMember.userId).trim() === String(userId).trim(),
  );
}

/**
 * Returns the matching project member for `userId`, if found.
 */
export function getProjectMember(
  userId: string,
  projectMembers: ProjectMember[],
): ProjectMember | undefined {
  return projectMembers.find(
    (projectMember) =>
      String(projectMember.userId).trim() === String(userId).trim(),
  );
}
