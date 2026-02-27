/**
 * Guard for project-scoped membership checks.
 *
 * `@ProjectMemberRole()` uses this guard to ensure the current user belongs to
 * the target project, with optional role constraints.
 */
import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectMemberRole as ProjectMemberRoleEnum } from '../enums/projectMemberRole.enum';
import { ProjectMember } from '../interfaces/permission.interface';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { PrismaService } from '../modules/global/prisma.service';
import { PermissionService } from '../services/permission.service';

/**
 * Metadata key for required project member roles.
 */
export const PROJECT_MEMBER_ROLES_KEY = 'project_member_roles';

/**
 * Writes required project member roles to route metadata.
 *
 * @param roles Allowed project member roles.
 */
export const RequireProjectMemberRoles = (...roles: ProjectMemberRoleEnum[]) =>
  SetMetadata(PROJECT_MEMBER_ROLES_KEY, roles);

/**
 * Enforces that the caller is a member of the project from route params.
 */
@Injectable()
export class ProjectMemberGuard implements CanActivate {
  /**
   * @param reflector Metadata reader for `RequireProjectMemberRoles`.
   * @param prisma Prisma client used to load project members.
   * @param permissionService Permission helper for role intersections.
   */
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * Enforces project membership and optional required project roles.
   *
   * Behavior:
   * - Throws `UnauthorizedException` if `user.userId` is missing.
   * - Throws `ForbiddenException` if `projectId` route param is missing.
   * - Resolves members from request cache or database.
   * - Throws `ForbiddenException('User is not a project member.')` when no
   * matching member exists.
   * - Throws `ForbiddenException('User does not have required project role.')`
   * when required roles are declared and no role matches.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException('User context is missing.');
    }

    const projectId = this.extractProjectId(request);
    if (!projectId) {
      throw new ForbiddenException('projectId route param is required.');
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<ProjectMemberRoleEnum[]>(
        PROJECT_MEMBER_ROLES_KEY,
        [context.getHandler(), context.getClass()],
      ) || [];

    const projectMembers = await this.resolveProjectMembers(request, projectId);
    const member = projectMembers.find(
      (projectMember) =>
        String(projectMember.userId).trim() === String(user.userId).trim(),
    );

    if (!member) {
      throw new ForbiddenException('User is not a project member.');
    }

    if (
      requiredRoles.length > 0 &&
      !this.permissionService.hasIntersection([member.role], requiredRoles)
    ) {
      throw new ForbiddenException('User does not have required project role.');
    }

    return true;
  }

  /**
   * Extracts the route `projectId` value.
   *
   * @returns Trimmed project id or `undefined` when blank/missing.
   */
  private extractProjectId(request: AuthenticatedRequest): string | undefined {
    const projectId = request.params?.projectId;

    if (typeof projectId !== 'string' || projectId.trim().length === 0) {
      return undefined;
    }

    return projectId.trim();
  }

  /**
   * Resolves project members from request cache or database and updates cache.
   *
   * Behavior:
   * - Returns cached members from `request.projectContext` if the project id
   * matches.
   * - Queries `prisma.projectMember.findMany` with soft-delete filtering.
   * - Converts Prisma enum role values to plain strings.
   * - Stores the result in `request.projectContext`.
   *
   * @todo The Prisma query and role-mapping logic is duplicated in
   * `ProjectContextInterceptor`, `PermissionGuard`, and `CopilotAndAboveGuard`.
   * Extract a shared `ProjectContextService.resolveMembers(projectId)` helper.
   */
  private async resolveProjectMembers(
    request: AuthenticatedRequest,
    projectId: string,
  ): Promise<ProjectMember[]> {
    if (
      request.projectContext?.projectId === projectId &&
      Array.isArray(request.projectContext.projectMembers)
    ) {
      return request.projectContext.projectMembers;
    }

    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId: BigInt(projectId),
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
      projectId,
      projectMembers: mappedProjectMembers,
    };

    return mappedProjectMembers;
  }
}

/**
 * Composite decorator for project membership enforcement with optional roles.
 *
 * @param roles Accepted project member roles.
 */
export const ProjectMemberRole = (...roles: ProjectMemberRoleEnum[]) =>
  applyDecorators(
    UseGuards(ProjectMemberGuard),
    RequireProjectMemberRoles(...roles),
  );
