/**
 * Parameter decorator that injects the validated JWT user from the request.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../modules/global/jwt.service';
import { AuthenticatedRequest } from '../interfaces/request.interface';

/**
 * Injects `request.user` into a controller handler parameter.
 *
 * Returns `undefined` when auth guards did not populate the request. Public
 * routes marked with `@OptionalAuthenticated()` receive a user when a valid
 * bearer token is supplied and remain undefined for anonymous callers.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
