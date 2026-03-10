import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PERMISSION } from '../constants/permissions.constants';
import { ProjectMemberRole } from '../enums/projectMemberRole.enum';
import { PrismaService } from '../modules/global/prisma.service';
import { PermissionService } from '../services/permission.service';
import { CopilotAndAboveGuard } from './copilotAndAbove.guard';

describe('CopilotAndAboveGuard', () => {
  let guard: CopilotAndAboveGuard;

  const permissionServiceMock = {
    hasPermission: jest.fn(),
  };

  const prismaServiceMock = {
    projectMember: {
      findMany: jest.fn(),
    },
  };

  const createExecutionContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new CopilotAndAboveGuard(
      permissionServiceMock as unknown as PermissionService,
      prismaServiceMock as unknown as PrismaService,
    );
  });

  it('throws UnauthorizedException when user context is missing', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          params: {
            projectId: '1001',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows access when permission check passes', async () => {
    const request: Record<string, any> = {
      user: {
        userId: '123',
      },
      params: {
        projectId: '1001',
      },
      projectContext: {
        projectId: '1001',
        projectMembers: [
          {
            userId: '123',
            role: ProjectMemberRole.MANAGER,
          },
        ],
      },
    };

    permissionServiceMock.hasPermission.mockReturnValue(true);

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
    expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith(
      PERMISSION.ROLES_COPILOT_AND_ABOVE,
      request.user,
      request.projectContext.projectMembers,
    );
  });

  it('throws ForbiddenException when permission check fails', async () => {
    permissionServiceMock.hasPermission.mockReturnValue(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          user: {
            userId: '123',
          },
          params: {
            projectId: '1001',
          },
          projectContext: {
            projectId: '1001',
            projectMembers: [],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('loads project members from Prisma when context is missing', async () => {
    const request: Record<string, any> = {
      user: {
        userId: '123',
      },
      params: {
        projectId: '1001',
      },
    };

    prismaServiceMock.projectMember.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        projectId: BigInt(1001),
        userId: BigInt(123),
        role: ProjectMemberRole.MANAGER,
        isPrimary: true,
        deletedAt: null,
      },
    ]);
    permissionServiceMock.hasPermission.mockReturnValue(true);

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(prismaServiceMock.projectMember.findMany).toHaveBeenCalledTimes(1);
    expect(request.projectContext.projectId).toBe('1001');
    expect(request.projectContext.projectMembers).toHaveLength(1);
  });

  it('passes undefined members to permission service when projectId is missing', async () => {
    const request: Record<string, any> = {
      user: {
        userId: '123',
      },
      params: {},
    };

    permissionServiceMock.hasPermission.mockReturnValue(false);

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
    expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith(
      PERMISSION.ROLES_COPILOT_AND_ABOVE,
      request.user,
      undefined,
    );
  });

  it('throws BadRequestException when projectId is not numeric', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          user: {
            userId: '123',
          },
          params: {
            projectId: 'abc',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
  });
});
