/**
 * Parameter decorator that injects project members from request context.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ProjectMember } from '../interfaces/permission.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';

/**
 * Injects `request.projectContext.projectMembers` into handler parameters.
 *
 * Returns an empty list when project context is unavailable.
 */
export const ProjectMembers = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectMember[] => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.projectContext?.projectMembers || [];
  },
);
