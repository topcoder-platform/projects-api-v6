import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, MANAGER_ROLES } from '../enums/userRole.enum';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { M2MService } from '../modules/global/m2m.service';
import { PermissionService } from '../services/permission.service';
import { Roles } from './tokenRoles.guard';

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

export const AdminOnly = () => applyDecorators(UseGuards(AdminOnlyGuard));

export const ManagerOnly = () => applyDecorators(Roles(...MANAGER_ROLES));
