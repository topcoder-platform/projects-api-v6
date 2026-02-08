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

export const PROJECT_MEMBER_ROLES_KEY = 'project_member_roles';

export const RequireProjectMemberRoles = (...roles: ProjectMemberRoleEnum[]) =>
  SetMetadata(PROJECT_MEMBER_ROLES_KEY, roles);

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

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

  private extractProjectId(request: AuthenticatedRequest): string | undefined {
    const projectId = request.params?.projectId;

    if (typeof projectId !== 'string' || projectId.trim().length === 0) {
      return undefined;
    }

    return projectId.trim();
  }

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

export const ProjectMemberRole = (...roles: ProjectMemberRoleEnum[]) =>
  applyDecorators(
    UseGuards(ProjectMemberGuard),
    RequireProjectMemberRoles(...roles),
  );
