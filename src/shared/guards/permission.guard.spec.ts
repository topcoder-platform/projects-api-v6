import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums/userRole.enum';
import { Permission } from '../interfaces/permission.interface';
import { PermissionService } from '../services/permission.service';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const permissionServiceMock = {
    hasPermission: jest.fn(),
    isPermissionRequireProjectMembers: jest.fn(),
    hasNamedPermission: jest.fn(),
    isNamedPermissionRequireProjectMembers: jest.fn(),
    isNamedPermissionRequireProjectInvites: jest.fn(),
  };

  const prismaServiceMock = {
    projectMember: {
      findMany: jest.fn(),
    },
    projectMemberInvite: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionGuard(
      reflectorMock as unknown as Reflector,
      permissionServiceMock as unknown as PermissionService,
      prismaServiceMock as any,
    );
  });

  const createExecutionContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  it('allows access when permission is valid', async () => {
    const permission: Permission = {
      topcoderRoles: [UserRole.TOPCODER_ADMIN],
    };

    reflectorMock.getAllAndOverride.mockReturnValue([permission]);
    permissionServiceMock.isPermissionRequireProjectMembers.mockReturnValue(
      false,
    );
    permissionServiceMock.hasPermission.mockReturnValue(true);

    const result = await guard.canActivate(
      createExecutionContext({
        user: {
          roles: [UserRole.TOPCODER_ADMIN],
          isMachine: false,
        },
      }),
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when permission is invalid', async () => {
    const permission: Permission = {
      topcoderRoles: [UserRole.TOPCODER_ADMIN],
    };

    reflectorMock.getAllAndOverride.mockReturnValue([permission]);
    permissionServiceMock.isPermissionRequireProjectMembers.mockReturnValue(
      false,
    );
    permissionServiceMock.hasPermission.mockReturnValue(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          user: {
            roles: [UserRole.TOPCODER_USER],
            isMachine: false,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('supports multiple permissions with OR logic', async () => {
    const permissions: Permission[] = [
      { topcoderRoles: [UserRole.MANAGER] },
      { topcoderRoles: [UserRole.TOPCODER_ADMIN] },
    ];

    reflectorMock.getAllAndOverride.mockReturnValue(permissions);
    permissionServiceMock.isPermissionRequireProjectMembers.mockReturnValue(
      false,
    );
    permissionServiceMock.hasPermission
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const result = await guard.canActivate(
      createExecutionContext({
        user: {
          roles: [UserRole.TOPCODER_ADMIN],
          isMachine: false,
        },
      }),
    );

    expect(result).toBe(true);
  });

  it('uses loaded project members when available', async () => {
    const permission: Permission = {
      projectRoles: true,
    };

    reflectorMock.getAllAndOverride.mockReturnValue([permission]);
    permissionServiceMock.isPermissionRequireProjectMembers.mockReturnValue(
      true,
    );
    permissionServiceMock.hasPermission.mockReturnValue(true);

    const request = {
      user: {
        userId: '123',
        isMachine: false,
      },
      params: {
        projectId: '1',
      },
      projectContext: {
        projectId: '1',
        projectMembers: [
          {
            userId: '123',
            role: 'manager',
          },
        ],
      },
    };

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith(
      permission,
      request.user,
      request.projectContext.projectMembers,
    );
    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
  });

  it('works without project members for non-project permission', async () => {
    const permission: Permission = {
      topcoderRoles: [UserRole.MANAGER],
    };

    reflectorMock.getAllAndOverride.mockReturnValue([permission]);
    permissionServiceMock.isPermissionRequireProjectMembers.mockReturnValue(
      false,
    );
    permissionServiceMock.hasPermission.mockReturnValue(true);

    const result = await guard.canActivate(
      createExecutionContext({
        user: {
          roles: [UserRole.MANAGER],
          isMachine: false,
        },
      }),
    );

    expect(result).toBe(true);
    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
  });

  it('does not refetch project members when a zero-member project was already loaded', async () => {
    const permission: Permission = {
      projectRoles: true,
    };

    reflectorMock.getAllAndOverride.mockReturnValue([permission]);
    permissionServiceMock.isPermissionRequireProjectMembers.mockReturnValue(
      true,
    );
    permissionServiceMock.hasPermission.mockReturnValue(true);
    prismaServiceMock.projectMember.findMany.mockResolvedValue([]);

    const request = {
      user: {
        userId: '123',
        isMachine: false,
      },
      params: {
        projectId: '1001',
      },
    };

    await guard.canActivate(createExecutionContext(request));
    await guard.canActivate(createExecutionContext(request));

    expect(prismaServiceMock.projectMember.findMany).toHaveBeenCalledTimes(1);
    expect(request.projectContext.projectMembersLoaded).toBe(true);
    expect(request.projectContext.projectMembers).toEqual([]);
  });
});
