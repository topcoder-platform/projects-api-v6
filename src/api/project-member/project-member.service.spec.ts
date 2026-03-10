import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProjectMemberRole } from '@prisma/client';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectMemberService } from './project-member.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishMemberEvent: jest.fn(() => Promise.resolve()),
  publishMemberEventSafely: jest.fn(),
}));

const eventUtils = jest.requireMock('src/shared/utils/event.utils');

describe('ProjectMemberService', () => {
  const prismaMock = {
    project: {
      findFirst: jest.fn(),
    },
    projectMember: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  const memberServiceMock = {
    getUserRoles: jest.fn(),
    getMemberDetailsByUserIds: jest.fn(),
  };

  let service: ProjectMemberService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectMemberService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
      memberServiceMock as unknown as MemberService,
    );
  });

  it('adds member and publishes member.added event', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [],
    });

    const txMock = {
      projectMember: {
        create: jest.fn().mockResolvedValue({
          id: BigInt(1),
          projectId: BigInt(1001),
          userId: BigInt(123),
          role: ProjectMemberRole.customer,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 123,
          updatedBy: 123,
          deletedAt: null,
          deletedBy: null,
        }),
      },
      projectMemberInvite: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.CREATE_PROJECT_MEMBER_OWN) {
          return true;
        }

        return false;
      },
    );

    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);

    const result = await service.addMember(
      '1001',
      {
        role: ProjectMemberRole.customer,
      },
      {
        userId: '123',
        roles: ['Topcoder User'],
        isMachine: false,
      },
      undefined,
    );

    expect(txMock.projectMember.create).toHaveBeenCalled();
    expect(eventUtils.publishMemberEventSafely).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_MEMBER_ADDED,
      expect.any(Object),
      expect.any(Object),
    );
    expect((result as any).id).toBe('1');
  });

  it('adds a project member for machine principals inferred from token claims', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [],
    });

    const txMock = {
      projectMember: {
        create: jest.fn().mockResolvedValue({
          id: BigInt(2),
          projectId: BigInt(1001),
          userId: BigInt(456),
          role: ProjectMemberRole.customer,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: -1,
          updatedBy: -1,
          deletedAt: null,
          deletedBy: null,
        }),
      },
      projectMemberInvite: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.CREATE_PROJECT_MEMBER_NOT_OWN,
    );
    memberServiceMock.getUserRoles.mockResolvedValue(['Topcoder User']);
    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);

    await service.addMember(
      '1001',
      {
        userId: '456',
        role: ProjectMemberRole.customer,
      },
      {
        isMachine: false,
        scopes: ['write:project-members'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:project-members',
          sub: 'svc-projects',
        },
      },
      undefined,
    );

    expect(txMock.projectMember.create).toHaveBeenCalledWith({
      data: {
        projectId: BigInt(1001),
        userId: BigInt(456),
        role: ProjectMemberRole.customer,
        createdBy: -1,
        updatedBy: -1,
      },
    });
  });

  it('rejects invalid target user ids before querying the project', async () => {
    await expect(
      service.addMember(
        '1001',
        {
          userId: 'invalid' as unknown as string,
          role: ProjectMemberRole.customer,
        },
        {
          userId: '123',
          roles: ['Topcoder User'],
          isMachine: false,
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.project.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects out-of-range target user ids before querying the project', async () => {
    await expect(
      service.addMember(
        '1001',
        {
          userId: '10000000000000011111',
          role: ProjectMemberRole.customer,
        },
        {
          userId: '123',
          roles: ['Topcoder User'],
          isMachine: false,
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.project.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('updates a project member for machine principals inferred from token claims', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [
        {
          id: BigInt(2),
          projectId: BigInt(1001),
          userId: BigInt(456),
          role: ProjectMemberRole.customer,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: 1,
          deletedAt: null,
          deletedBy: null,
        },
      ],
    });

    const txMock = {
      projectMember: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({
          id: BigInt(2),
          projectId: BigInt(1001),
          userId: BigInt(456),
          role: ProjectMemberRole.customer,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: -1,
          deletedAt: null,
          deletedBy: null,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER,
    );

    await service.updateMember(
      '1001',
      '2',
      {
        role: ProjectMemberRole.customer,
      },
      {
        isMachine: false,
        scopes: ['write:project-members'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:project-members',
          sub: 'svc-projects',
        },
      },
      undefined,
    );

    expect(txMock.projectMember.update).toHaveBeenCalledWith({
      where: {
        id: BigInt(2),
      },
      data: {
        role: ProjectMemberRole.customer,
        isPrimary: undefined,
        updatedBy: -1,
      },
    });
  });

  it('deletes a project member for machine principals inferred from token claims', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [
        {
          id: BigInt(9),
          projectId: BigInt(1001),
          userId: BigInt(456),
          role: ProjectMemberRole.manager,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: 1,
          deletedAt: null,
          deletedBy: null,
        },
      ],
    });

    const txMock = {
      projectMember: {
        update: jest.fn().mockResolvedValue({
          id: BigInt(9),
          projectId: BigInt(1001),
          userId: BigInt(456),
          role: ProjectMemberRole.manager,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: -1,
          deletedAt: new Date(),
          deletedBy: BigInt(-1),
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.DELETE_PROJECT_MEMBER_TOPCODER,
    );

    await service.deleteMember('1001', '9', {
      isMachine: false,
      scopes: ['write:project-members'],
      tokenPayload: {
        gty: 'client-credentials',
        scope: 'write:project-members',
        sub: 'svc-projects',
      },
    });

    expect(txMock.projectMember.update).toHaveBeenCalledWith({
      where: {
        id: BigInt(9),
      },
      data: {
        deletedAt: expect.any(Date),
        deletedBy: BigInt(-1),
        updatedBy: -1,
      },
    });
  });

  it('fails deleting topcoder member without permission', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [
        {
          id: BigInt(9),
          projectId: BigInt(1001),
          userId: BigInt(999),
          role: ProjectMemberRole.manager,
          isPrimary: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: 1,
          deletedAt: null,
          deletedBy: null,
        },
      ],
    });

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.DELETE_PROJECT_MEMBER_TOPCODER) {
          return false;
        }

        return false;
      },
    );

    await expect(
      service.deleteMember('1001', '9', {
        userId: '123',
        isMachine: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
