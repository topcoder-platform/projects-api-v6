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

@Injectable()
export class CopilotAndAboveGuard implements CanActivate {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService,
  ) {}

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

export const CopilotAndAbove = () =>
  applyDecorators(UseGuards(CopilotAndAboveGuard));
