import { ForbiddenException } from '@nestjs/common';
import { InviteStatus, ProjectMemberRole } from '@prisma/client';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { Permission } from 'src/shared/constants/permissions';
import { EmailService } from 'src/shared/services/email.service';
import { IdentityService } from 'src/shared/services/identity.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectInviteService } from './project-invite.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishInviteEvent: jest.fn(() => Promise.resolve()),
  publishMemberEvent: jest.fn(() => Promise.resolve()),
  publishNotificationEvent: jest.fn(() => Promise.resolve()),
}));

const eventUtils = jest.requireMock('src/shared/utils/event.utils');

describe('ProjectInviteService', () => {
  const prismaMock = {
    project: {
      findFirst: jest.fn(),
    },
    projectMemberInvite: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  const memberServiceMock = {
    getMemberDetailsByHandles: jest.fn(),
    getMemberDetailsByUserIds: jest.fn(),
    getUserRoles: jest.fn(),
  };

  const identityServiceMock = {
    lookupMultipleUserEmails: jest.fn(),
  };

  const emailServiceMock = {
    sendInviteEmail: jest.fn(),
  };

  let service: ProjectInviteService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ProjectInviteService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
      memberServiceMock as unknown as MemberService,
      identityServiceMock as unknown as IdentityService,
      emailServiceMock as unknown as EmailService,
    );
  });

  it('creates invite and publishes event', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo',
      members: [],
    });

    prismaMock.projectMemberInvite.findMany.mockResolvedValue([]);

    memberServiceMock.getMemberDetailsByHandles.mockResolvedValue([
      {
        userId: 123,
        handle: 'member',
        handleLower: 'member',
        email: 'member@topcoder.com',
      },
    ]);

    memberServiceMock.getUserRoles.mockResolvedValue(['Topcoder User']);
    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);
    identityServiceMock.lookupMultipleUserEmails.mockResolvedValue([]);

    const txMock = {
      projectMemberInvite: {
        create: jest.fn().mockResolvedValue({
          id: BigInt(1),
          projectId: BigInt(1001),
          userId: BigInt(123),
          email: 'member@topcoder.com',
          role: ProjectMemberRole.customer,
          status: InviteStatus.pending,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 99,
          updatedBy: 99,
          deletedAt: null,
          deletedBy: null,
          applicationId: null,
        }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.CREATE_PROJECT_INVITE_COPILOT) {
          return false;
        }

        return true;
      },
    );

    const response = await service.createInvites(
      '1001',
      {
        handles: ['member'],
        role: ProjectMemberRole.customer,
      },
      {
        userId: '99',
        isMachine: false,
      },
      undefined,
    );

    expect(response.success).toHaveLength(1);
    expect(eventUtils.publishInviteEvent).toHaveBeenCalled();
    expect(eventUtils.publishNotificationEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_MEMBER_INVITE_SENT,
      expect.objectContaining({
        projectId: '1001',
        inviteId: '1',
        role: ProjectMemberRole.customer,
        email: 'member@topcoder.com',
        userId: '123',
        initiatorUserId: '99',
      }),
    );
  });

  it('publishes invite accepted notification when invite is accepted', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [],
    });

    prismaMock.projectMemberInvite.findFirst.mockResolvedValue({
      id: BigInt(10),
      projectId: BigInt(1001),
      userId: BigInt(123),
      email: 'member@topcoder.com',
      role: ProjectMemberRole.customer,
      status: InviteStatus.pending,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 1,
      updatedBy: 1,
      deletedAt: null,
      deletedBy: null,
      applicationId: null,
    });

    const txMock = {
      projectMemberInvite: {
        update: jest.fn().mockResolvedValue({
          id: BigInt(10),
          projectId: BigInt(1001),
          userId: BigInt(123),
          email: 'member@topcoder.com',
          role: ProjectMemberRole.customer,
          status: InviteStatus.accepted,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: 99,
          deletedAt: null,
          deletedBy: null,
          applicationId: null,
        }),
      },
      projectMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: BigInt(777),
          projectId: BigInt(1001),
          userId: BigInt(123),
          role: ProjectMemberRole.customer,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 1,
          updatedBy: 1,
          deletedAt: null,
          deletedBy: null,
        }),
      },
      copilotRequest: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    prismaMock.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) => callback(txMock),
    );

    await service.updateInvite(
      '1001',
      '10',
      {
        status: InviteStatus.accepted,
      },
      {
        userId: '123',
        isMachine: false,
      },
      undefined,
    );

    expect(eventUtils.publishNotificationEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_MEMBER_INVITE_ACCEPTED,
      expect.objectContaining({
        projectId: '1001',
        inviteId: '10',
        role: ProjectMemberRole.customer,
        email: 'member@topcoder.com',
        userId: '123',
        initiatorUserId: '123',
        memberId: '777',
      }),
    );
  });

  it('blocks deleting not-own requested invite without permission', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [],
    });

    prismaMock.projectMemberInvite.findFirst.mockResolvedValue({
      id: BigInt(10),
      projectId: BigInt(1001),
      userId: BigInt(500),
      email: null,
      role: ProjectMemberRole.copilot,
      status: InviteStatus.requested,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 1,
      updatedBy: 1,
      deletedAt: null,
      deletedBy: null,
      applicationId: null,
    });

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.DELETE_PROJECT_INVITE_REQUESTED) {
          return false;
        }

        return true;
      },
    );

    await expect(
      service.deleteInvite('1001', '10', {
        userId: '99',
        isMachine: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
