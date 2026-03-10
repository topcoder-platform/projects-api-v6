import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectMemberRole } from '../enums/projectMemberRole.enum';
import { PermissionService } from '../services/permission.service';
import {
  PROJECT_MEMBER_ROLES_KEY,
  ProjectMemberGuard,
} from './projectMember.guard';

describe('ProjectMemberGuard', () => {
  let guard: ProjectMemberGuard;

  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const prismaServiceMock = {
    projectMember: {
      findMany: jest.fn(),
    },
  };

  const permissionServiceMock = {
    hasIntersection: jest.fn(),
  };

  const createExecutionContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new ProjectMemberGuard(
      reflectorMock as unknown as Reflector,
      prismaServiceMock as any,
      permissionServiceMock as unknown as PermissionService,
    );
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === PROJECT_MEMBER_ROLES_KEY) {
        return [];
      }
      return undefined;
    });
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

  it('throws ForbiddenException when projectId route param is missing', async () => {
    await expect(
      guard.canActivate(
        createExecutionContext({
          user: {
            userId: '123',
          },
          params: {},
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows access for project members', async () => {
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

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(prismaServiceMock.projectMember.findMany).toHaveBeenCalledTimes(1);
    expect(request.projectContext.projectId).toBe('1001');
    expect(request.projectContext.projectMembers[0].role).toBe(
      ProjectMemberRole.MANAGER,
    );
  });

  it('throws ForbiddenException when user is not a project member', async () => {
    prismaServiceMock.projectMember.findMany.mockResolvedValue([
      {
        userId: BigInt(999),
        role: ProjectMemberRole.MANAGER,
      },
    ]);

    await expect(
      guard.canActivate(
        createExecutionContext({
          user: {
            userId: '123',
          },
          params: {
            projectId: '1001',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException when required project role is missing', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === PROJECT_MEMBER_ROLES_KEY) {
        return [ProjectMemberRole.MANAGER];
      }
      return undefined;
    });
    permissionServiceMock.hasIntersection.mockReturnValue(false);
    prismaServiceMock.projectMember.findMany.mockResolvedValue([
      {
        userId: BigInt(123),
        role: ProjectMemberRole.CUSTOMER,
      },
    ]);

    await expect(
      guard.canActivate(
        createExecutionContext({
          user: {
            userId: '123',
          },
          params: {
            projectId: '1001',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows access when required project role is present', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === PROJECT_MEMBER_ROLES_KEY) {
        return [ProjectMemberRole.COPILOT, ProjectMemberRole.MANAGER];
      }
      return undefined;
    });
    permissionServiceMock.hasIntersection.mockReturnValue(true);
    prismaServiceMock.projectMember.findMany.mockResolvedValue([
      {
        userId: BigInt(123),
        role: ProjectMemberRole.MANAGER,
      },
    ]);

    const result = await guard.canActivate(
      createExecutionContext({
        user: {
          userId: '123',
        },
        params: {
          projectId: '1001',
        },
      }),
    );

    expect(result).toBe(true);
    expect(permissionServiceMock.hasIntersection).toHaveBeenCalledWith(
      [ProjectMemberRole.MANAGER],
      [ProjectMemberRole.COPILOT, ProjectMemberRole.MANAGER],
    );
  });

  it('uses cached project members from request context', async () => {
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

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
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
