import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, MANAGER_ROLES } from '../enums/userRole.enum';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { M2MService } from '../modules/global/m2m.service';
import { PermissionService } from '../services/permission.service';
import { Roles } from './tokenRoles.guard';

export const SWAGGER_ADMIN_ONLY_KEY = 'x-admin-only';
export const SWAGGER_ADMIN_ALLOWED_ROLES_KEY = 'x-admin-only-roles';
export const SWAGGER_ADMIN_ALLOWED_SCOPES_KEY = 'x-admin-only-scopes';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly m2mService: M2MService,
  ) {}

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

export const AdminOnly = () =>
  applyDecorators(
    UseGuards(AdminOnlyGuard),
    ApiExtension(SWAGGER_ADMIN_ONLY_KEY, true),
    ApiExtension(SWAGGER_ADMIN_ALLOWED_ROLES_KEY, ADMIN_ROLES),
    ApiExtension(SWAGGER_ADMIN_ALLOWED_SCOPES_KEY, [
      Scope.CONNECT_PROJECT_ADMIN,
    ]),
  );

export const ManagerOnly = () => applyDecorators(Roles(...MANAGER_ROLES));
