import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../modules/global/jwt.service';
import { AuthenticatedRequest } from '../interfaces/request.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
