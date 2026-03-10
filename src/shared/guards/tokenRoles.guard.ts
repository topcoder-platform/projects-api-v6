/**
 * Primary authentication and coarse-grained authorization guard applied across
 * the API surface.
 *
 * The guard supports:
 * - `@Public()` escape hatch for unauthenticated routes.
 * - Bearer token extraction and JWT validation.
 * - Dual authorization flow for human tokens and M2M tokens.
 */
import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiExtension } from '@nestjs/swagger';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { JwtService } from '../modules/global/jwt.service';
import { M2MService } from '../modules/global/m2m.service';
import { ADMIN_ONLY_KEY } from './auth-metadata.constants';

/**
 * Metadata key for required Topcoder roles declared with `@Roles()`.
 */
export const ROLES_KEY = 'roles';
/**
 * Swagger extension key used to expose required roles in OpenAPI operations.
 */
export const SWAGGER_REQUIRED_ROLES_KEY = 'x-required-roles';
/**
 * Metadata key for explicit "any authenticated token" access.
 */
export const ANY_AUTHENTICATED_KEY = 'any_authenticated';
/**
 * Swagger extension key used to expose explicit any-authenticated access.
 */
export const SWAGGER_ANY_AUTHENTICATED_KEY = 'x-any-authenticated';
/**
 * Declares allowed Topcoder roles for a route.
 *
 * The decorator writes both runtime metadata and Swagger metadata.
 *
 * @param roles Roles accepted by this route. Matching is case-insensitive.
 */
export const Roles = (...roles: string[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiExtension(SWAGGER_REQUIRED_ROLES_KEY, roles),
  );

/**
 * Marks a route as accessible by any validated token.
 *
 * Use this decorator explicitly when a route should not constrain roles/scopes
 * beyond authentication itself.
 */
export const AnyAuthenticated = () =>
  applyDecorators(
    SetMetadata(ANY_AUTHENTICATED_KEY, true),
    ApiExtension(SWAGGER_ANY_AUTHENTICATED_KEY, true),
  );

/**
 * Global auth guard that validates JWT tokens and applies role/scope checks.
 */
@Injectable()
export class TokenRolesGuard implements CanActivate {
  /**
   * @param reflector Nest metadata reader for auth decorators.
   * @param jwtService Service that validates and parses JWT payloads.
   * @param m2mService Service that classifies machine tokens and scope checks.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly m2mService: M2MService,
  ) {}

  /**
   * Authenticates and authorizes the incoming request.
   *
   * Behavior:
   * - Returns `true` for `@Public()` routes.
   * - Throws `UnauthorizedException` when Bearer token is absent or malformed.
   * - Calls `JwtService.validateToken` and stores the validated user on request.
   * - Reads both `@Roles()` and `@Scopes()` metadata.
   * - Requires one of `@Roles()`, `@Scopes()`, `@AnyAuthenticated()`, or
   *   `@AdminOnly()`.
   * - Throws `ForbiddenException` when no auth metadata is declared.
   * - Returns `true` for any authenticated user when `@AnyAuthenticated()` is present.
   * - Returns `true` for `@AdminOnly()` routes without additional role/scope
   *   metadata so the route-specific `AdminOnlyGuard` can make the final
   *   authorization decision.
   * - For M2M tokens: requires declared scopes and checks scope intersection.
   * - For human tokens: allows if any required role or scope matches.
   * - Throws `ForbiddenException('Insufficient permissions')` otherwise.
   */
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
    const isAnyAuthenticated =
      this.reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || false;
    const isAdminOnly =
      this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || false;

    if (
      normalizedRequiredRoles.length === 0 &&
      normalizedRequiredScopes.length === 0 &&
      !isAnyAuthenticated &&
      !isAdminOnly
    ) {
      throw new ForbiddenException('Authorization metadata is required');
    }

    if (isAnyAuthenticated) {
      return true;
    }

    if (
      isAdminOnly &&
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

  /**
   * Normalizes role/scope strings for case-insensitive comparison.
   *
   * @param values Role/scope values to normalize.
   * @returns Trimmed, lowercase, non-empty values.
   */
  private normalizeValues(values: string[]): string[] {
    return values
      .map((value) => String(value).trim().toLowerCase())
      .filter((value) => value.length > 0);
  }
}
