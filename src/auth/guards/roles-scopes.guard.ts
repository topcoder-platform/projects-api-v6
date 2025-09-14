/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// src/auth/guards/roles.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SCOPES_KEY } from '../decorators/scopes.decorator';

@Injectable()
export class RolesScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequired = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const scopesRequired = this.reflector.getAllAndOverride<string[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const rolesRequiredFlag = rolesRequired && rolesRequired.length > 0;
    const scopesRequiredFlag = scopesRequired && scopesRequired.length > 0;
    if (!rolesRequiredFlag && !scopesRequiredFlag) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.authUser;
    if (!user) throw new ForbiddenException('Missing authUser');

    // roles might be array or comma-separated string depending on token source
    const roles: string[] = Array.isArray(user.roles)
      ? user.roles
      : (user.roles || user.role || '')
          .split(',')
          .map((r: string) => r.trim())
          .filter(Boolean);

    const rolesOK = roles.some((r: string) => rolesRequired?.includes(r));

    const scopes: string[] = Array.isArray(user.scopes)
      ? user.scopes
      : (user.scope || '')
          .split(' ')
          .map((s: string) => s.trim())
          .filter(Boolean);
    const scopesFixed: string[] = [];
    scopes.forEach((scope) => {
      scopesFixed.push(scope);
      if (scope.startsWith('all:')) {
        const scopeName = scope.substring(4);
        scopesFixed.push('read:' + scopeName);
        scopesFixed.push('write:' + scopeName);
      }
    });

    const scopesOK = scopesRequired?.every((s) => scopesFixed.includes(s));
    if (rolesRequiredFlag && scopesRequiredFlag && !scopesOK && !rolesOK) {
      throw new ForbiddenException(
        'Insufficient role or Missing required scope(s)',
      );
    } else if (!rolesRequiredFlag && scopesRequiredFlag && !scopesOK) {
      throw new ForbiddenException('Missing required scope(s)');
    } else if (rolesRequiredFlag && !scopesRequiredFlag && !rolesOK) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
