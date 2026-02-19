import { ForbiddenException } from '@nestjs/common';
import { ProjectMemberRole } from '@prisma/client';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectMemberService } from './project-member.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishMemberEvent: jest.fn(() => Promise.resolve()),
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
    expect(eventUtils.publishMemberEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_MEMBER_ADDED,
      expect.any(Object),
    );
    expect((result as any).id).toBe('1');
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
