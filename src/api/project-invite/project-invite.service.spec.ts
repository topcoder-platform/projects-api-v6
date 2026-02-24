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
  publishMemberEventSafely: jest.fn(),
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

  it('creates invite', async () => {
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
    expect(emailServiceMock.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('sends invite email with isSSO=true for known user invited by email', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo',
      members: [],
    });

    prismaMock.projectMemberInvite.findMany.mockResolvedValue([]);

    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);
    identityServiceMock.lookupMultipleUserEmails.mockResolvedValue([
      {
        id: '123',
        email: 'member@topcoder.com',
        handle: 'member',
      },
    ]);

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

    await service.createInvites(
      '1001',
      {
        emails: ['member@topcoder.com'],
        role: ProjectMemberRole.customer,
      },
      {
        userId: '99',
        isMachine: false,
      },
      undefined,
    );

    expect(emailServiceMock.sendInviteEmail).toHaveBeenCalledTimes(1);
    expect(emailServiceMock.sendInviteEmail).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({
        email: 'member@topcoder.com',
      }),
      expect.objectContaining({
        userId: '99',
      }),
      'Demo',
      {
        isSSO: true,
      },
    );
  });

  it('sends invite email with isSSO=false for unknown email', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo',
      members: [],
    });

    prismaMock.projectMemberInvite.findMany.mockResolvedValue([]);

    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);
    identityServiceMock.lookupMultipleUserEmails.mockResolvedValue([]);

    const txMock = {
      projectMemberInvite: {
        create: jest.fn().mockResolvedValue({
          id: BigInt(2),
          projectId: BigInt(1001),
          userId: null,
          email: 'unknown@topcoder.com',
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

    await service.createInvites(
      '1001',
      {
        emails: ['unknown@topcoder.com'],
        role: ProjectMemberRole.customer,
      },
      {
        userId: '99',
        isMachine: false,
      },
      undefined,
    );

    expect(emailServiceMock.sendInviteEmail).toHaveBeenCalledTimes(1);
    expect(emailServiceMock.sendInviteEmail).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({
        email: 'unknown@topcoder.com',
      }),
      expect.objectContaining({
        userId: '99',
      }),
      'Demo',
      {
        isSSO: false,
      },
    );
  });

  it('publishes member.added when invite is accepted', async () => {
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

    expect(eventUtils.publishMemberEventSafely).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_MEMBER_ADDED,
      expect.objectContaining({
        projectId: '1001',
        id: '777',
        role: ProjectMemberRole.customer,
        userId: '123',
      }),
      expect.anything(),
    );
  });

  it('accepts email-only invite and creates project member for authenticated user', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [],
    });

    prismaMock.projectMemberInvite.findFirst.mockResolvedValue({
      id: BigInt(11),
      projectId: BigInt(1001),
      userId: null,
      email: 'jmgasper+devtest140@gmail.com',
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
          id: BigInt(11),
          projectId: BigInt(1001),
          userId: null,
          email: 'jmgasper+devtest140@gmail.com',
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
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: BigInt(778),
          projectId: BigInt(1001),
          userId: BigInt(88770025),
          role: ProjectMemberRole.customer,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 99,
          updatedBy: 99,
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
      '11',
      {
        status: InviteStatus.accepted,
      },
      {
        userId: '88770025',
        isMachine: false,
        tokenPayload: {
          email: 'jmgasper+devtest140@gmail.com',
        },
      },
      undefined,
    );

    expect(txMock.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: BigInt(1001),
          role: ProjectMemberRole.customer,
          userId: BigInt(88770025),
        }),
      }),
    );
    expect(eventUtils.publishMemberEventSafely).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_MEMBER_ADDED,
      expect.objectContaining({
        id: '778',
        projectId: '1001',
        userId: '88770025',
      }),
      expect.anything(),
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
