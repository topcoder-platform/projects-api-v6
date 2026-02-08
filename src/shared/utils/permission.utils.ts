import { ProjectMember } from '../interfaces/permission.interface';
import { JwtUser } from '../modules/global/jwt.service';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, UserRole } from '../enums/userRole.enum';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function hasRoles(user: JwtUser, roles: string[]): boolean {
  const userRoles = (user.roles || []).map(normalize);
  const normalizedRoles = roles.map(normalize);

  return normalizedRoles.some((role) => userRoles.includes(role));
}

export function hasAdminRole(user: JwtUser): boolean {
  const normalizedScopes = (user.scopes || []).map(normalize);

  return (
    hasRoles(user, ADMIN_ROLES) ||
    normalizedScopes.includes(normalize(Scope.CONNECT_PROJECT_ADMIN)) ||
    normalizedScopes.includes(normalize(Scope.CONNECT_PROJECT_ADMIN_ALIAS))
  );
}

export function hasProjectManagerRole(user: JwtUser): boolean {
  return hasRoles(user, [UserRole.PROJECT_MANAGER]);
}

export function isProjectMember(
  userId: string,
  projectMembers: ProjectMember[],
): boolean {
  return projectMembers.some(
    (projectMember) =>
      String(projectMember.userId).trim() === String(userId).trim(),
  );
}

export function getProjectMember(
  userId: string,
  projectMembers: ProjectMember[],
): ProjectMember | undefined {
  return projectMembers.find(
    (projectMember) =>
      String(projectMember.userId).trim() === String(userId).trim(),
  );
}
