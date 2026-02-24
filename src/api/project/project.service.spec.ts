import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectService } from './project.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishProjectEvent: jest.fn(() => Promise.resolve()),
}));

const eventUtils = jest.requireMock('src/shared/utils/event.utils');

describe('ProjectService', () => {
  const prismaMock = {
    project: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    projectType: {
      findFirst: jest.fn(),
    },
    projectTemplate: {
      findFirst: jest.fn(),
    },
    projectMemberInvite: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  const billingAccountServiceMock = {
    getBillingAccountsForProject: jest.fn(),
    getBillingAccountsByIds: jest.fn(),
    getDefaultBillingAccount: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([]);
    service = new ProjectService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
      billingAccountServiceMock as any,
    );
  });

  it('lists projects with pagination and filters invites by own permission', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.READ_PROJECT_ANY) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_MEMBER) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_INVITE_NOT_OWN) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_INVITE_OWN) {
          return true;
        }

        return true;
      },
    );

    prismaMock.project.count.mockResolvedValue(1);
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: BigInt(1001),
        name: 'Demo',
        type: 'app',
        status: 'in_review',
        lastActivityAt: new Date(),
        lastActivityUserId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 100,
        updatedBy: 100,
        version: 'v3',
        terms: [],
        groups: [],
        members: [
          {
            userId: BigInt(100),
            role: 'customer',
            deletedAt: null,
          },
        ],
        invites: [
          {
            id: BigInt(1),
            projectId: BigInt(1001),
            userId: BigInt(100),
            role: 'customer',
            status: 'pending',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: BigInt(2),
            projectId: BigInt(1001),
            userId: BigInt(200),
            role: 'customer',
            status: 'pending',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        attachments: [],
      },
    ]);

    const result = await service.listProjects(
      {
        page: 1,
        perPage: 20,
        fields: 'invites',
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].invites).toHaveLength(1);
    expect(result.data[0].invites?.[0].userId).toBe('100');
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          members: expect.any(Object),
          invites: expect.any(Object),
        }),
      }),
    );
  });

  it('lists own email invites when invite userId is missing', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.READ_PROJECT_ANY) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_MEMBER) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_INVITE_NOT_OWN) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_INVITE_OWN) {
          return true;
        }

        return true;
      },
    );

    prismaMock.project.count.mockResolvedValue(1);
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: BigInt(1001),
        name: 'Demo',
        type: 'app',
        status: 'in_review',
        lastActivityAt: new Date(),
        lastActivityUserId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 100,
        updatedBy: 100,
        version: 'v3',
        terms: [],
        groups: [],
        members: [],
        invites: [
          {
            id: BigInt(1),
            projectId: BigInt(1001),
            userId: null,
            email: 'JMGasper+devtest140@gmail.com',
            role: 'customer',
            status: 'pending',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: BigInt(2),
            projectId: BigInt(1001),
            userId: null,
            email: 'someone-else@example.com',
            role: 'customer',
            status: 'pending',
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        attachments: [],
      },
    ]);

    const result = await service.listProjects(
      {
        page: 1,
        perPage: 20,
        fields: 'invites',
      },
      {
        userId: '88770025',
        email: 'jmgasper+devtest140@gmail.com',
        isMachine: false,
      },
    );

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].invites).toHaveLength(1);
    expect(result.data[0].invites?.[0].email).toBe(
      'JMGasper+devtest140@gmail.com',
    );
  });

  it('does not load relation payloads by default in project listing', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.READ_PROJECT_ANY ||
        permission === Permission.READ_PROJECT_MEMBER,
    );

    const now = new Date();

    prismaMock.project.count.mockResolvedValue(1);
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'active',
        billingAccountId: null,
        directProjectId: null,
        estimatedPrice: null,
        actualPrice: null,
        terms: [],
        groups: [],
        external: null,
        bookmarks: null,
        utm: null,
        details: null,
        challengeEligibility: null,
        cancelReason: null,
        templateId: null,
        version: 'v3',
        lastActivityAt: now,
        lastActivityUserId: '100',
        createdAt: now,
        updatedAt: now,
        createdBy: 100,
        updatedBy: 100,
      },
    ]);

    const result = await service.listProjects(
      {
        page: 1,
        perPage: 20,
      },
      {
        userId: '100',
        roles: ['administrator'],
        isMachine: false,
      },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].members).toBeUndefined();
    expect(result.data[0].invites).toBeUndefined();
    expect(result.data[0].attachments).toBeUndefined();
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {},
      }),
    );
  });

  it('adds billing account name to project listing when available', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.READ_PROJECT_ANY ||
        permission === Permission.READ_PROJECT_MEMBER,
    );

    const now = new Date();

    prismaMock.project.count.mockResolvedValue(1);
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'active',
        billingAccountId: BigInt(80001063),
        directProjectId: null,
        estimatedPrice: null,
        actualPrice: null,
        terms: [],
        groups: [],
        external: null,
        bookmarks: null,
        utm: null,
        details: null,
        challengeEligibility: null,
        cancelReason: null,
        templateId: null,
        version: 'v3',
        lastActivityAt: now,
        lastActivityUserId: '100',
        createdAt: now,
        updatedAt: now,
        createdBy: 100,
        updatedBy: 100,
      },
    ]);
    billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({
      '80001063': {
        name: 'Acme BA',
        tcBillingAccountId: '80001063',
      },
    });

    const result = await service.listProjects(
      {
        page: 1,
        perPage: 20,
      },
      {
        userId: '100',
        roles: ['administrator'],
        isMachine: false,
      },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].billingAccountName).toBe('Acme BA');
    expect(
      billingAccountServiceMock.getBillingAccountsByIds,
    ).toHaveBeenCalledWith(['80001063']);
  });

  it('adds billing account name to project details when available', async () => {
    const now = new Date();

    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo',
      description: null,
      type: 'app',
      status: 'active',
      billingAccountId: BigInt(80001063),
      directProjectId: null,
      estimatedPrice: null,
      actualPrice: null,
      terms: [],
      groups: [],
      external: null,
      bookmarks: null,
      utm: null,
      details: null,
      challengeEligibility: null,
      cancelReason: null,
      templateId: null,
      version: 'v3',
      lastActivityAt: now,
      lastActivityUserId: '100',
      createdAt: now,
      updatedAt: now,
      createdBy: 100,
      updatedBy: 100,
      members: [],
      invites: [],
      attachments: [],
    });
    billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({
      '80001063': {
        name: 'Acme BA',
        tcBillingAccountId: '80001063',
      },
    });

    const result = await service.getProject('1001', undefined, {
      userId: '100',
      roles: ['administrator'],
      isMachine: false,
    });

    expect(result.billingAccountName).toBe('Acme BA');
    expect(
      billingAccountServiceMock.getBillingAccountsByIds,
    ).toHaveBeenCalledWith(['80001063']);
  });

  it('throws NotFoundException when project is missing', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(
      service.getProject('999', undefined, {
        userId: '123',
        isMachine: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists billing accounts for project id', async () => {
    billingAccountServiceMock.getBillingAccountsForProject.mockResolvedValue([
      {
        tcBillingAccountId: '123123',
      },
    ]);

    const result = await service.listProjectBillingAccounts('001001', {
      userId: '123',
      isMachine: false,
    });

    expect(result).toEqual([
      {
        tcBillingAccountId: '123123',
      },
    ]);
    expect(
      billingAccountServiceMock.getBillingAccountsForProject,
    ).toHaveBeenCalledWith('1001', '123');
  });

  it('returns project billing account and strips markup for user tokens', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      billingAccountId: BigInt(12),
    });
    billingAccountServiceMock.getDefaultBillingAccount.mockResolvedValue({
      tcBillingAccountId: '12',
      markup: 50,
      active: true,
    });

    const result = await service.getProjectBillingAccount('1001', {
      userId: '123',
      isMachine: false,
    });

    expect(result).toEqual({
      tcBillingAccountId: '12',
      active: true,
    });
    expect(
      billingAccountServiceMock.getDefaultBillingAccount,
    ).toHaveBeenCalledWith('12');
  });

  it('returns project billing account markup for m2m tokens', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      billingAccountId: BigInt(12),
    });
    billingAccountServiceMock.getDefaultBillingAccount.mockResolvedValue({
      tcBillingAccountId: '12',
      markup: 50,
      active: true,
    });

    const result = await service.getProjectBillingAccount('1001', {
      scopes: ['read:project-billing-account-details'],
      isMachine: true,
    });

    expect(result).toEqual({
      tcBillingAccountId: '12',
      markup: 50,
      active: true,
    });
  });

  it('throws when billing account is not attached to the project', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      billingAccountId: null,
    });

    await expect(
      service.getProjectBillingAccount('1001', {
        userId: '123',
        isMachine: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('loads members and invites for permission checks when fields omit them', async () => {
    const now = new Date();

    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo',
      description: null,
      type: 'app',
      status: 'in_review',
      billingAccountId: null,
      directProjectId: null,
      estimatedPrice: null,
      actualPrice: null,
      terms: [],
      groups: [],
      external: null,
      bookmarks: null,
      details: null,
      challengeEligibility: null,
      templateId: null,
      version: 'v3',
      lastActivityAt: now,
      lastActivityUserId: '100',
      createdAt: now,
      updatedAt: now,
      createdBy: 100,
      updatedBy: 100,
      members: [
        {
          id: BigInt(1),
          projectId: BigInt(1001),
          userId: BigInt(100),
          role: 'customer',
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
      invites: [
        {
          id: BigInt(2),
          projectId: BigInt(1001),
          userId: BigInt(200),
          email: null,
          role: 'customer',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ],
      attachments: [
        {
          id: BigInt(3),
          projectId: BigInt(1001),
          title: null,
          type: 'file',
          path: 'https://example.com/file',
          size: null,
          contentType: null,
          tags: [],
          allowedUsers: [],
          createdAt: now,
          updatedAt: now,
          createdBy: 100,
          updatedBy: 100,
          deletedAt: null,
        },
      ],
    });

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.VIEW_PROJECT) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_ANY) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_MEMBER) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_INVITE_NOT_OWN) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_INVITE_OWN) {
          return true;
        }

        return false;
      },
    );

    const result = await service.getProject('1001', 'attachments', {
      userId: '100',
      isMachine: false,
    });

    expect(prismaMock.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          members: expect.any(Object),
          invites: expect.any(Object),
          attachments: expect.any(Object),
        }),
      }),
    );

    const viewPermissionCall =
      permissionServiceMock.hasNamedPermission.mock.calls.find(
        ([permission]: [Permission]) => permission === Permission.VIEW_PROJECT,
      );

    expect(viewPermissionCall?.[2]).toHaveLength(1);
    expect(viewPermissionCall?.[3]).toHaveLength(1);
    expect(result.attachments).toHaveLength(1);
    expect(result.members).toBeUndefined();
    expect(result.invites).toBeUndefined();
  });

  it('blocks billing account id updates without permission', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      billingAccountId: BigInt(12),
      directProjectId: null,
      status: 'in_review',
      members: [
        {
          userId: BigInt(100),
          role: 'manager',
          deletedAt: null,
        },
      ],
      invites: [],
    });

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.EDIT_PROJECT) {
          return true;
        }

        if (permission === Permission.MANAGE_PROJECT_BILLING_ACCOUNT_ID) {
          return false;
        }

        return true;
      },
    );

    await expect(
      service.updateProject(
        '1001',
        {
          billingAccountId: 99,
        },
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes project and emits event', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [
        {
          userId: BigInt(100),
          role: 'manager',
          deletedAt: null,
        },
      ],
    });

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.DELETE_PROJECT,
    );

    prismaMock.project.update.mockResolvedValue({
      id: BigInt(1001),
    });

    await service.deleteProject('1001', {
      userId: '100',
      isMachine: false,
    });

    expect(prismaMock.project.update).toHaveBeenCalled();
    expect(eventUtils.publishProjectEvent).toHaveBeenCalled();
  });

  it('creates project and publishes project.created event', async () => {
    prismaMock.projectType.findFirst.mockResolvedValue({
      key: 'app',
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            create: jest.fn().mockResolvedValue({
              id: BigInt(1001),
              status: 'in_review',
            }),
          },
          projectMember: {
            create: jest.fn().mockResolvedValue({}),
          },
          projectHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
    );
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo Project',
      description: null,
      type: 'app',
      status: 'in_review',
      billingAccountId: null,
      directProjectId: null,
      estimatedPrice: null,
      actualPrice: null,
      terms: [],
      groups: [],
      external: null,
      bookmarks: null,
      details: {
        utm: {
          code: 'ABC',
        },
      },
      challengeEligibility: null,
      templateId: null,
      version: 'v3',
      lastActivityAt: new Date(),
      lastActivityUserId: '100',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 100,
      updatedBy: 100,
      members: [],
      invites: [],
      attachments: [],
      phases: [],
    });
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.CREATE_PROJECT_AS_MANAGER,
    );

    await service.createProject(
      {
        name: 'Demo Project',
        type: 'app',
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(eventUtils.publishProjectEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_CREATED,
      expect.any(Object),
    );
  });

  it('publishes project.updated event during update', async () => {
    prismaMock.project.findFirst
      .mockResolvedValueOnce({
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'in_review',
        billingAccountId: BigInt(11),
        directProjectId: null,
        details: {},
        bookmarks: null,
        members: [
          {
            userId: BigInt(100),
            role: 'manager',
            deletedAt: null,
          },
        ],
        invites: [],
      })
      .mockResolvedValueOnce({
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'active',
        billingAccountId: BigInt(22),
        directProjectId: null,
        estimatedPrice: null,
        actualPrice: null,
        terms: [],
        groups: [],
        external: null,
        bookmarks: null,
        details: {},
        challengeEligibility: null,
        templateId: null,
        version: 'v3',
        lastActivityAt: new Date(),
        lastActivityUserId: '100',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 100,
        updatedBy: 100,
        members: [
          {
            id: BigInt(1),
            projectId: BigInt(1001),
            userId: BigInt(100),
            role: 'manager',
            isPrimary: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            deletedBy: null,
            createdBy: 100,
            updatedBy: 100,
          },
        ],
        invites: [],
        attachments: [],
        phases: [],
      });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            update: jest.fn().mockResolvedValue({
              id: BigInt(1001),
            }),
          },
          projectHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
    );
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);

    await service.updateProject(
      '1001',
      {
        status: 'active' as any,
        billingAccountId: 22,
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(eventUtils.publishProjectEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_UPDATED,
      expect.any(Object),
    );
  });
});
