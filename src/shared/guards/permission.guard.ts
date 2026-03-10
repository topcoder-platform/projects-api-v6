/**
 * Fine-grained authorization guard driven by `@RequirePermission()` metadata.
 *
 * This guard evaluates named or inline permissions using `PermissionService`.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/requirePermission.decorator';
import {
  ProjectInvite,
  ProjectMember,
} from '../interfaces/permission.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { PrismaService } from '../modules/global/prisma.service';
import { PermissionService } from '../services/permission.service';
import { parseNumericStringId } from '../utils/service.utils';

/**
 * Policy guard that evaluates route-level permission requirements.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  /**
   * @param reflector Metadata reader for `@RequirePermission()`.
   * @param permissionService Permission evaluator.
   * @param prisma Prisma client used for lazy project context loading.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolves and evaluates route permissions.
   *
   * Behavior:
   * - Returns `true` when no `@RequirePermission()` metadata is declared.
   * - Throws `UnauthorizedException` if `request.user` is missing.
   * - Lazily loads project context via `resolveProjectContextIfRequired`.
   * - Evaluates each permission and allows if any match.
   * - Throws `BadRequestException` when a required `projectId` param is not numeric.
   * - Throws `ForbiddenException('Insufficient permissions')` otherwise.
   *
   * @security Routes without `@RequirePermission()` bypass this guard's checks.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<RequiredPermission[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permissions || permissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User context is missing.');
    }

    const { projectMembers, projectInvites } =
      await this.resolveProjectContextIfRequired(request, permissions);

    const hasPermission = permissions.some((permission) => {
      if (typeof permission === 'string') {
        return this.permissionService.hasNamedPermission(
          permission,
          user,
          projectMembers,
          projectInvites,
        );
      }

      return this.permissionService.hasPermission(
        permission,
        user,
        projectMembers,
      );
    });

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  /**
   * Loads project members/invites only when the requested permissions require
   * project-scoped context.
   *
   * Behavior:
   * - Skips DB access if no project id or no project-scoped permission exists.
   * - Throws `BadRequestException` when a required `projectId` param is not numeric.
   * - Resets cached context when project id changes.
   * - Loads `projectMember` rows when required and members are not loaded yet.
   * - Loads `projectMemberInvite` rows when required and invites are not
   *   loaded yet.
   * - Tracks independent `projectMembersLoaded` / `projectInvitesLoaded`
   *   flags so empty arrays do not suppress the first database load.
   * @todo Member/invite query and mapping logic is duplicated in multiple guards
   * and `ProjectContextInterceptor`; extract a shared `ProjectContextService`.
   */
  private async resolveProjectContextIfRequired(
    request: AuthenticatedRequest,
    permissions: RequiredPermission[],
  ): Promise<{
    projectMembers: ProjectMember[];
    projectInvites: ProjectInvite[];
  }> {
    const projectId = request.params?.projectId;
    const normalizedProjectId =
      typeof projectId === 'string' && projectId.trim().length > 0
        ? projectId.trim()
        : undefined;

    const requiresProjectMembers = permissions.some((permission) =>
      this.requireProjectMembers(permission),
    );

    const requiresProjectInvites = permissions.some((permission) =>
      this.requireProjectInvites(permission),
    );

    if (
      !normalizedProjectId ||
      (!requiresProjectMembers && !requiresProjectInvites)
    ) {
      return {
        projectMembers: request.projectContext?.projectMembers || [],
        projectInvites: request.projectContext?.projectInvites || [],
      };
    }

    const parsedProjectId = parseNumericStringId(
      normalizedProjectId,
      'Project id',
    );

    if (!request.projectContext) {
      request.projectContext = {
        projectMembers: [],
        projectMembersLoaded: false,
        projectInvites: [],
        projectInvitesLoaded: false,
      };
    } else if (
      request.projectContext.projectMembersLoaded === undefined &&
      request.projectContext.projectId === normalizedProjectId &&
      Array.isArray(request.projectContext.projectMembers)
    ) {
      // Backward-compatible bridge for context objects that predate the flag.
      request.projectContext.projectMembersLoaded = true;
    }

    if (
      request.projectContext.projectInvitesLoaded === undefined &&
      request.projectContext.projectId === normalizedProjectId &&
      Array.isArray(request.projectContext.projectInvites)
    ) {
      // Backward-compatible bridge for context objects that predate the flag.
      request.projectContext.projectInvitesLoaded = true;
    }

    if (request.projectContext.projectId !== normalizedProjectId) {
      request.projectContext.projectId = normalizedProjectId;
      request.projectContext.projectMembers = [];
      request.projectContext.projectMembersLoaded = false;
      request.projectContext.projectInvites = [];
      request.projectContext.projectInvitesLoaded = false;
    }

    if (
      requiresProjectMembers &&
      request.projectContext.projectMembersLoaded !== true
    ) {
      const projectMembers = await this.prisma.projectMember.findMany({
        where: {
          projectId: parsedProjectId,
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

      request.projectContext.projectMembers = projectMembers.map((member) => ({
        ...member,
        role: String(member.role),
      }));
      request.projectContext.projectMembersLoaded = true;
    }

    if (
      requiresProjectInvites &&
      request.projectContext.projectInvitesLoaded !== true
    ) {
      const projectInvites = await this.prisma.projectMemberInvite.findMany({
        where: {
          projectId: parsedProjectId,
          deletedAt: null,
        },
        select: {
          id: true,
          projectId: true,
          userId: true,
          email: true,
          status: true,
          deletedAt: true,
        },
      });

      request.projectContext.projectInvites = projectInvites.map((invite) => ({
        ...invite,
        status: String(invite.status),
      }));
      request.projectContext.projectInvitesLoaded = true;
    }

    return {
      projectMembers: request.projectContext.projectMembers || [],
      projectInvites: request.projectContext.projectInvites || [],
    };
  }

  /**
   * Checks if a permission depends on project members.
   *
   * Delegates named and inline permissions to `PermissionService`.
   */
  private requireProjectMembers(permission: RequiredPermission): boolean {
    if (typeof permission === 'string') {
      return this.permissionService.isNamedPermissionRequireProjectMembers(
        permission,
      );
    }

    return this.permissionService.isPermissionRequireProjectMembers(permission);
  }

  /**
   * Checks if a permission depends on project invites.
   *
   * Only named permission keys are supported; inline `Permission` objects return
   * `false`.
   */
  private requireProjectInvites(permission: RequiredPermission): boolean {
    if (typeof permission !== 'string') {
      return false;
    }

    return this.permissionService.isNamedPermissionRequireProjectInvites(
      permission,
    );
  }
}
