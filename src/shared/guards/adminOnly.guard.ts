/**
 * Secondary guard that enforces admin-level access.
 *
 * Route-level entry points are:
 * - `@AdminOnly()` for strict admin checks.
 * - `@ManagerOnly()` as a role-based shorthand without this guard.
 */
import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, MANAGER_ROLES, UserRole } from '../enums/userRole.enum';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { M2MService } from '../modules/global/m2m.service';
import { PermissionService } from '../services/permission.service';
import { ADMIN_ONLY_KEY } from './auth-metadata.constants';
import { Roles } from './tokenRoles.guard';

/**
 * Swagger extension key indicating an admin-only operation.
 */
export const SWAGGER_ADMIN_ONLY_KEY = 'x-admin-only';
/**
 * Swagger extension key listing admin roles accepted by the guard.
 */
export const SWAGGER_ADMIN_ALLOWED_ROLES_KEY = 'x-admin-only-roles';
/**
 * Swagger extension key listing M2M scopes accepted by the guard.
 */
export const SWAGGER_ADMIN_ALLOWED_SCOPES_KEY = 'x-admin-only-scopes';

/**
 * Human admin roles documented in Swagger for admin-only endpoints.
 *
 * Runtime admin detection still accepts legacy `Connect Admin` tokens to
 * preserve backward compatibility, but the public contract is
 * `administrator`/`tgadmin` plus the documented M2M scope.
 */
const DOCUMENTED_ADMIN_ROLES: UserRole[] = [
  UserRole.TOPCODER_ADMIN,
  UserRole.TG_ADMIN,
];

/**
 * Guard that permits only admin roles or admin-equivalent M2M scope.
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  /**
   * @param permissionService Permission helper for role intersections.
   * @param m2mService M2M helper for scope hierarchy checks.
   */
  constructor(
    private readonly permissionService: PermissionService,
    private readonly m2mService: M2MService,
  ) {}

  /**
   * Enforces admin-only access after `TokenRolesGuard` has populated user data.
   *
   * Behavior:
   * - Throws `UnauthorizedException` if `request.user` is missing.
   * - Grants access for any role in `ADMIN_ROLES`.
   * - Grants access for scope `CONNECT_PROJECT_ADMIN`.
   * - Throws `ForbiddenException('Admin access is required.')` otherwise.
   *
   * @security M2M callers that already passed `TokenRolesGuard` with non-admin
   * scopes can reach this guard; `CONNECT_PROJECT_ADMIN` is the only M2M
   * admission criterion here.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User context is missing.');
    }

    const hasAdminRole = this.permissionService.hasIntersection(
      user.roles || [],
      ADMIN_ROLES,
    );

    if (hasAdminRole) {
      return true;
    }

    const hasAdminScope = this.m2mService.hasRequiredScopes(user.scopes || [], [
      Scope.CONNECT_PROJECT_ADMIN,
    ]);

    if (hasAdminScope) {
      return true;
    }

    throw new ForbiddenException('Admin access is required.');
  }
}

/**
 * Composite decorator that applies `AdminOnlyGuard` and Swagger auth metadata.
 */
export const AdminOnly = () =>
  applyDecorators(
    SetMetadata(ADMIN_ONLY_KEY, true),
    UseGuards(AdminOnlyGuard),
    ApiExtension(SWAGGER_ADMIN_ONLY_KEY, true),
    ApiExtension(SWAGGER_ADMIN_ALLOWED_ROLES_KEY, DOCUMENTED_ADMIN_ROLES),
    ApiExtension(SWAGGER_ADMIN_ALLOWED_SCOPES_KEY, [
      Scope.CONNECT_PROJECT_ADMIN,
    ]),
  );

/**
 * Role-only shorthand for manager-tier routes.
 *
 * This decorator only applies `Roles(...MANAGER_ROLES)` and does not attach
 * `AdminOnlyGuard`.
 */
export const ManagerOnly = () => applyDecorators(Roles(...MANAGER_ROLES));
