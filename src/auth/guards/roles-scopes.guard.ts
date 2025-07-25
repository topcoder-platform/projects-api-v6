// roles-scopes.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtUser } from '../auth.dto';

@Injectable()
export class RolesScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    const scopes = this.reflector.get<string[]>('scopes', context.getHandler());

    if (!roles && !scopes) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser;

    // use case insensitive checking
    const userRoles = user.roles?.map(t => t.toLowerCase());
    const userScopes = user.scopes?.map(t => t.toLowerCase());

    const hasRoles = roles && roles?.some(role => userRoles.includes(role.toLowerCase()));
    const hasScopes = scopes && scopes?.some(scope => userScopes.includes(scope.toLowerCase()));

    if (hasRoles || hasScopes) return true;

    throw new ForbiddenException('Forbidden resource');
  }
}