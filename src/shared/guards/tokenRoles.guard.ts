import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { JwtService } from '../modules/global/jwt.service';
import { M2MService } from '../modules/global/m2m.service';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class TokenRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly m2mService: M2MService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Invalid or missing token');
    }

    const user = await this.jwtService.validateToken(token);
    request.user = user;

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const normalizedRequiredRoles = this.normalizeValues(requiredRoles);
    const normalizedRequiredScopes = this.normalizeValues(requiredScopes);

    if (
      normalizedRequiredRoles.length === 0 &&
      normalizedRequiredScopes.length === 0
    ) {
      return true;
    }

    const machineContext = this.m2mService.validateMachineToken(
      user.tokenPayload,
    );

    if (machineContext.isMachine) {
      if (normalizedRequiredScopes.length === 0) {
        throw new ForbiddenException('M2M token not allowed for this endpoint');
      }

      if (
        this.m2mService.hasRequiredScopes(
          machineContext.scopes,
          normalizedRequiredScopes,
        )
      ) {
        return true;
      }

      throw new ForbiddenException('Insufficient scopes');
    }

    const normalizedUserRoles = this.normalizeValues(user.roles || []);
    const normalizedUserScopes = this.normalizeValues(user.scopes || []);

    if (
      normalizedRequiredRoles.length > 0 &&
      normalizedRequiredRoles.some((requiredRole) =>
        normalizedUserRoles.includes(requiredRole),
      )
    ) {
      return true;
    }

    if (
      normalizedRequiredScopes.length > 0 &&
      this.m2mService.hasRequiredScopes(
        normalizedUserScopes,
        normalizedRequiredScopes,
      )
    ) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private normalizeValues(values: string[]): string[] {
    return values
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => value.length > 0);
  }
}
