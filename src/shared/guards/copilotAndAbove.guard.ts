/**
 * Convenience guard for "copilot and above" authorization.
 *
 * This guard currently uses the deprecated
 * `PERMISSION.ROLES_COPILOT_AND_ABOVE` policy.
 */
import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PERMISSION } from '../constants/permissions.constants';
import { ProjectMember } from '../interfaces/permission.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { PrismaService } from '../modules/global/prisma.service';
import { PermissionService } from '../services/permission.service';

/**
 * Guard enforcing the legacy copilot-and-above permission tier.
 */
@Injectable()
export class CopilotAndAboveGuard implements CanActivate {
  /**
   * @param permissionService Permission evaluator.
   * @param prisma Prisma client used for member resolution.
   */
  constructor(
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enforces `PERMISSION.ROLES_COPILOT_AND_ABOVE` for the request user.
   *
   * Behavior:
   * - Throws `UnauthorizedException` when `request.user` is missing.
   * - Loads project members via `resolveProjectMembers`.
   * - Calls `permissionService.hasPermission(...)`.
   * - Throws `ForbiddenException` when permission check fails.
   *
   * @deprecated `PERMISSION.ROLES_COPILOT_AND_ABOVE` is deprecated in
   * `permissions.constants.ts`. Migrate callers to explicit
   * `@RequirePermission()` usage with a clear permission key.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User context is missing.');
    }

    const projectMembers = await this.resolveProjectMembers(request);

    const hasPermission = this.permissionService.hasPermission(
      PERMISSION.ROLES_COPILOT_AND_ABOVE,
      user,
      projectMembers,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permissions to perform this action.',
      );
    }

    return true;
  }

  /**
   * Resolves project members from request cache or database.
   *
   * @todo The Prisma query + role mapping pattern is duplicated across this
   * guard, `ProjectMemberGuard`, `PermissionGuard`, and
   * `ProjectContextInterceptor`. Extract a shared resolver service.
   */
  private async resolveProjectMembers(
    request: AuthenticatedRequest,
  ): Promise<ProjectMember[] | undefined> {
    const projectId = request.params?.projectId;

    if (typeof projectId !== 'string' || projectId.trim().length === 0) {
      return undefined;
    }

    const normalizedProjectId = projectId.trim();

    if (
      request.projectContext?.projectId === normalizedProjectId &&
      Array.isArray(request.projectContext.projectMembers)
    ) {
      return request.projectContext.projectMembers;
    }

    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId: BigInt(normalizedProjectId),
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        isPrimary: true,
        deletedAt: true,
      },
    });

    const mappedProjectMembers = projectMembers.map((member) => ({
      ...member,
      role: String(member.role),
    }));

    request.projectContext = {
      projectId: normalizedProjectId,
      projectMembers: mappedProjectMembers,
    };

    return mappedProjectMembers;
  }
}

/**
 * Composite decorator that applies `CopilotAndAboveGuard`.
 */
export const CopilotAndAbove = () =>
  applyDecorators(UseGuards(CopilotAndAboveGuard));
