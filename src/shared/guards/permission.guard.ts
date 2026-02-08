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

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService,
  ) {}

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

    if (!request.projectContext) {
      request.projectContext = {
        projectMembers: [],
      };
    }

    if (request.projectContext.projectId !== normalizedProjectId) {
      request.projectContext.projectId = normalizedProjectId;
      request.projectContext.projectMembers = [];
      request.projectContext.projectInvites = [];
    }

    if (
      requiresProjectMembers &&
      request.projectContext.projectMembers.length === 0
    ) {
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

      request.projectContext.projectMembers = projectMembers.map((member) => ({
        ...member,
        role: String(member.role),
      }));
    }

    if (
      requiresProjectInvites &&
      !Array.isArray(request.projectContext.projectInvites)
    ) {
      const projectInvites = await this.prisma.projectMemberInvite.findMany({
        where: {
          projectId: BigInt(normalizedProjectId),
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
    }

    return {
      projectMembers: request.projectContext.projectMembers || [],
      projectInvites: request.projectContext.projectInvites || [],
    };
  }

  private requireProjectMembers(permission: RequiredPermission): boolean {
    if (typeof permission === 'string') {
      return this.permissionService.isNamedPermissionRequireProjectMembers(
        permission,
      );
    }

    return this.permissionService.isPermissionRequireProjectMembers(permission);
  }

  private requireProjectInvites(permission: RequiredPermission): boolean {
    if (typeof permission !== 'string') {
      return false;
    }

    return this.permissionService.isNamedPermissionRequireProjectInvites(
      permission,
    );
  }
}
