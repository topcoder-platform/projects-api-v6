import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ProjectMember } from '../interfaces/permission.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';

export const ProjectMembers = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectMember[] => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.projectContext?.projectMembers || [];
  },
);
