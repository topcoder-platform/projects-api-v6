import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectService } from './project.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishProjectEvent: jest.fn(() => Promise.resolve()),
  publishRawEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('src/shared/global/external-prisma.client', () => ({
  getChallengesPrismaClient: jest.fn(),
}));

const { getChallengesPrismaClient } = jest.requireMock(
  'src/shared/global/external-prisma.client',
);
const challengeFindMany = jest.fn();
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
    projectMember: {
      findMany: jest.fn(),
    },
    workManagementPermission: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
    hasPermission: jest.fn(),
    hasIntersection: jest.fn(),
    isNamedPermissionRequireProjectMembers: jest.fn(),
  };

  const billingAccountServiceMock = {
    getBillingAccountsForProject: jest.fn(),
    getBillingAccountsByIds: jest.fn(),
    getDefaultBillingAccount: jest.fn(),
  };

  const memberServiceMock = {
    getMemberDetailsByUserIds: jest.fn(),
    getUserRoles: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.clearAllMocks();
    getChallengesPrismaClient.mockReturnValue({
      challenge: { findMany: challengeFindMany },
    });
    challengeFindMany.mockResolvedValue([]);
    billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({});
    prismaMock.$queryRaw.mockResolvedValue([]);
    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);
    memberServiceMock.getUserRoles.mockResolvedValue([]);
    permissionServiceMock.hasIntersection.mockImplementation(
      (userRoles: string[] = [], allowedRoles: string[] = []) =>
        userRoles.some((userRole) =>
          allowedRoles.some(
            (allowedRole) =>
              String(userRole).trim().toLowerCase() ===
              String(allowedRole).trim().toLowerCase(),
          ),
        ),
    );
    service = new ProjectService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
      billingAccountServiceMock as any,
      memberServiceMock as any,
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

  it.each([UserRole.TALENT_MANAGER, UserRole.TOPCODER_TALENT_MANAGER])(
    'lists non-member projects for %s',
    async (role) => {
      permissionServiceMock.hasIntersection.mockImplementation(
        (roles: string[], allowed: string[]) =>
          roles.some((value) => allowed.includes(value)),
      );
      prismaMock.project.count.mockResolvedValue(0);
      prismaMock.project.findMany.mockResolvedValue([]);
      await service.listProjects(
        { page: 1, perPage: 20 },
        { isMachine: false, userId: '999', roles: [role] },
      );
      expect(prismaMock.project.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    },
  );

  it.each([['project manager', UserRole.PROJECT_MANAGER]])(
    'scopes %s project listings to project membership',
    async (_label: string, role: UserRole) => {
      permissionServiceMock.hasNamedPermission.mockImplementation(
        (permission: Permission): boolean =>
          permission === Permission.READ_PROJECT_ANY ||
          permission === Permission.READ_PROJECT_MEMBER,
      );
      permissionServiceMock.hasIntersection.mockReturnValue(false);

      prismaMock.project.count.mockResolvedValue(0);
      prismaMock.project.findMany.mockResolvedValue([]);

      await service.listProjects(
        {
          page: 1,
          perPage: 20,
        },
        {
          userId: '999',
          roles: [role],
          isMachine: false,
        },
      );

      expect(prismaMock.project.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          AND: [
            {
              OR: [
                {
                  members: {
                    some: {
                      userId: BigInt(999),
                      deletedAt: null,
                    },
                  },
                },
                {
                  invites: {
                    some: {
                      userId: BigInt(999),
                      status: 'pending',
                      deletedAt: null,
                    },
                  },
                },
              ],
            },
          ],
        },
      });
    },
  );

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

  it('returns current metadata and full client with deduplicated lifetime challenge accounts', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.findFirst.mockResolvedValue({
      id: 1001n,
      billingAccountId: 12n,
      members: [],
      invites: [],
    });
    const client = {
      id: 'client-1',
      name: 'Acme',
      salesforceAccountId: '001',
      billingStreet: '1 Main Street',
      phone: '123',
      paymentTerms: 'Net 30',
    };
    const currentAccount = {
      tcBillingAccountId: '12',
      name: 'Current',
      salesforceBillingAccountId: 'a01',
      opportunity: '006',
      subscription: 'sub',
      costCenter: 'engineering',
      markup: 0.2,
      client,
    };
    billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({
      '12': currentAccount,
      '9': { tcBillingAccountId: '9', name: 'Previous', status: 'INACTIVE' },
    });
    challengeFindMany.mockResolvedValue([
      { projectId: 1001, billingRecord: { billingAccountId: '12' } },
      { projectId: 1001, billingRecord: { billingAccountId: '9' } },
      { projectId: 1001, billingRecord: { billingAccountId: '009' } },
      { projectId: 1001, billingRecord: { billingAccountId: '15' } },
      { projectId: 1001, billingRecord: null },
      { projectId: 1001, billingRecord: { billingAccountId: null } },
      { projectId: 1001, billingRecord: { billingAccountId: 'invalid' } },
    ]);
    const result = await service.getProject('1001', undefined, {
      userId: '100',
      roles: ['administrator'],
      isMachine: false,
    });
    expect(result.billingAccount).toEqual(currentAccount);
    expect(result.client).toEqual(client);
    expect(result.relatedBillingAccounts).toEqual([
      { tcBillingAccountId: '9', name: 'Previous', status: 'INACTIVE' },
      currentAccount,
      { tcBillingAccountId: '15' },
    ]);
    expect(
      billingAccountServiceMock.getBillingAccountsByIds,
    ).toHaveBeenCalledTimes(1);
    expect(
      billingAccountServiceMock.getBillingAccountsByIds,
    ).toHaveBeenCalledWith(['12', '9', '15']);
    expect(challengeFindMany).toHaveBeenCalledWith({
      where: { projectId: { in: [1001] } },
      select: {
        projectId: true,
        billingRecord: { select: { billingAccountId: true } },
      },
    });
  });

  it('shares billing lookups across a page and keeps histories scoped to each project', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.count.mockResolvedValue(3);
    prismaMock.project.findMany.mockResolvedValue([
      { id: 1n, billingAccountId: 12n },
      { id: 2n, billingAccountId: 12n },
      { id: 3n, billingAccountId: null },
    ]);
    challengeFindMany.mockResolvedValue([
      { projectId: 1, billingRecord: { billingAccountId: '9' } },
      { projectId: 2, billingRecord: { billingAccountId: '10' } },
      { projectId: 3, billingRecord: { billingAccountId: '9' } },
    ]);
    const result = await service.listProjects(
      {},
      { userId: '100', roles: ['administrator'], isMachine: false },
    );
    expect(challengeFindMany).toHaveBeenCalledTimes(1);
    expect(
      billingAccountServiceMock.getBillingAccountsByIds,
    ).toHaveBeenCalledWith(['12', '9', '10']);
    expect(
      result.data.map((project) => project.relatedBillingAccounts),
    ).toEqual([
      [{ tcBillingAccountId: '9' }],
      [{ tcBillingAccountId: '10' }],
      [{ tcBillingAccountId: '9' }],
    ]);
    expect(result.data[2].billingAccount).toBeNull();
    expect(result.data[2].client).toBeNull();
  });

  it('removes markup from current and historical accounts for copilot-only callers', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.findFirst.mockResolvedValue({
      id: 1001n,
      billingAccountId: 12n,
      members: [{ userId: 100n, role: 'copilot', deletedAt: null }],
      invites: [],
    });
    const account = { tcBillingAccountId: '12', markup: 0.3, name: 'Current' };
    billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({
      '12': account,
    });
    challengeFindMany.mockResolvedValue([
      { projectId: 1001, billingRecord: { billingAccountId: '12' } },
    ]);
    const result = await service.getProject('1001', undefined, {
      userId: '100',
      roles: ['copilot'],
      isMachine: false,
    });
    expect(result.billingAccount).not.toHaveProperty('markup');
    expect(result.relatedBillingAccounts[0]).not.toHaveProperty('markup');
    expect(account.markup).toBe(0.3);
  });

  it('returns empty billing relations when no current or challenge accounts exist', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.findFirst.mockResolvedValue({
      id: 1n,
      billingAccountId: null,
    });
    const result = await service.getProject('1', undefined, {
      userId: '100',
      roles: ['administrator'],
      isMachine: false,
    });
    expect(result).toMatchObject({
      billingAccount: null,
      client: null,
      relatedBillingAccounts: [],
    });
    expect(
      billingAccountServiceMock.getBillingAccountsByIds,
    ).not.toHaveBeenCalled();
  });

  it('preserves current billing data during a challenge database outage', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.findFirst.mockResolvedValue({
      id: 1n,
      billingAccountId: 12n,
    });
    challengeFindMany.mockRejectedValue(new Error('database unavailable'));
    const result = await service.getProject('1', undefined, {
      userId: '100',
      roles: ['administrator'],
      isMachine: false,
    });
    expect(result).toMatchObject({
      billingAccount: { tcBillingAccountId: '12' },
      relatedBillingAccounts: [],
    });
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

  it.each([
    ['project manager', UserRole.PROJECT_MANAGER, false],
    ['Talent Manager', UserRole.TALENT_MANAGER, true],
    ['Topcoder Talent Manager', UserRole.TOPCODER_TALENT_MANAGER, true],
  ])(
    'checks non-member direct access for %s',
    async (_label: string, role: UserRole, canView: boolean) => {
      const now = new Date();

      prismaMock.project.findFirst.mockResolvedValue({
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
        members: [
          {
            userId: BigInt(100),
            role: 'manager',
            deletedAt: null,
          },
        ],
        invites: [],
        attachments: [],
      });
      permissionServiceMock.hasNamedPermission.mockImplementation(
        (permission: Permission): boolean =>
          permission === Permission.VIEW_PROJECT ||
          permission === Permission.READ_PROJECT_ANY,
      );
      permissionServiceMock.hasIntersection.mockImplementation(
        (roles: string[], allowed: string[]) =>
          roles.some((value) => allowed.includes(value)),
      );

      const result = service.getProject('1001', undefined, {
        userId: '999',
        roles: [role],
        isMachine: false,
      });
      if (canView)
        await expect(result).resolves.toMatchObject({ name: 'Demo' });
      else await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each([UserRole.TALENT_MANAGER, UserRole.TOPCODER_TALENT_MANAGER])(
    'returns members, invites, and attachments of a non-member project to %s',
    async (role) => {
      const realPermissionService = new PermissionService({
        hasRequiredScopes: () => false,
        validateMachineToken: () => ({ isMachine: false, scopes: [] }),
      } as any);
      const serviceWithRealPermissions = new ProjectService(
        prismaMock as any,
        realPermissionService,
        billingAccountServiceMock as any,
        memberServiceMock as any,
      );
      prismaMock.project.findFirst.mockResolvedValue({
        id: 1001n,
        name: 'Non-internal',
        billingAccountId: null,
        members: [{ id: 1n, userId: 100n, role: 'manager', deletedAt: null }],
        invites: [
          {
            id: 2n,
            userId: 200n,
            email: null,
            status: 'pending',
            deletedAt: null,
          },
        ],
        attachments: [
          { id: 3n, createdBy: 100, allowedUsers: [], deletedAt: null },
        ],
      });

      const result = await serviceWithRealPermissions.getProject(
        '1001',
        'members,invites,attachments',
        { userId: '999', roles: [role], isMachine: false },
      );

      expect(result.members).toEqual([
        expect.objectContaining({ userId: '100', role: 'manager' }),
      ]);
      expect(result.invites).toEqual([
        expect.objectContaining({ userId: '200', status: 'pending' }),
      ]);
      expect(result.attachments).toHaveLength(1);
    },
  );

  describe('Talent Manager internal project membership override', () => {
    const originalIds = process.env.INTERNAL_BILLING_ACCOUNT_IDS;

    beforeEach(() => {
      process.env.INTERNAL_BILLING_ACCOUNT_IDS = '123';
      billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({});
      permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    });

    afterEach(() => {
      if (originalIds === undefined)
        delete process.env.INTERNAL_BILLING_ACCOUNT_IDS;
      else process.env.INTERNAL_BILLING_ACCOUNT_IDS = originalIds;
    });

    it.each([
      [UserRole.TALENT_MANAGER, 'manager', null, '42', true],
      [UserRole.TOPCODER_TALENT_MANAGER, 'read', null, '42', true],
      [UserRole.TALENT_MANAGER, 'customer', null, '42', true],
      [UserRole.TALENT_MANAGER, 'manager', new Date(), '42', false],
      [UserRole.TALENT_MANAGER, 'manager', null, '99', false],
    ])(
      'checks %s with project role %s, deletedAt %s, and user %s',
      async (role, memberRole, deletedAt, userId, allowed) => {
        prismaMock.project.findFirst.mockResolvedValue({
          id: 1001n,
          name: 'Internal',
          billingAccountId: 123n,
          members: [{ userId: 42n, role: memberRole, deletedAt }],
          invites: [
            { userId: BigInt(userId), status: 'pending', deletedAt: null },
          ],
        });
        const result = service.getProject('1001', 'id,name', {
          userId,
          roles: [role],
          isMachine: false,
        });
        if (allowed)
          await expect(result).resolves.toMatchObject({ name: 'Internal' });
        else await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it.each([false, true])(
      'uses the membership override for both list results and totals with memberOnly=%s',
      async (memberOnly) => {
        prismaMock.project.count.mockResolvedValue(1);
        prismaMock.project.findMany.mockResolvedValue([
          {
            id: 1001n,
            name: 'Internal',
            billingAccountId: 123n,
            members: [{ userId: 42n, role: 'read', deletedAt: null }],
            invites: [],
          },
        ]);
        const result = await service.listProjects(
          { memberOnly },
          {
            userId: '42',
            roles: [UserRole.TALENT_MANAGER],
            isMachine: false,
          },
        );
        expect(result.total).toBe(1);
        expect(result.data).toEqual([
          expect.objectContaining({ name: 'Internal' }),
        ]);
        const where = prismaMock.project.findMany.mock.calls[0][0].where;
        expect(prismaMock.project.count).toHaveBeenCalledWith({ where });
        expect(where.AND).toContainEqual({
          OR: [
            { billingAccountId: null },
            { billingAccountId: { notIn: [123n] } },
            { members: { some: { userId: 42n, deletedAt: null } } },
          ],
        });
      },
    );
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

  it('returns project billing account and strips markup for copilot-only user tokens', async () => {
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
      roles: [UserRole.TC_COPILOT],
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

  it('returns project billing account markup for Project Manager tokens', async () => {
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
      roles: [UserRole.PROJECT_MANAGER],
      isMachine: false,
    });

    expect(result).toEqual({
      tcBillingAccountId: '12',
      markup: 50,
      active: true,
    });
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

  it('returns project billing account markup for machine principals inferred from token claims', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      billingAccountId: BigInt(12),
    });
    billingAccountServiceMock.getDefaultBillingAccount.mockResolvedValue({
      tcBillingAccountId: '12',
      markup: 0.58,
      active: true,
    });

    const result = await service.getProjectBillingAccount('1001', {
      isMachine: false,
      scopes: [],
      tokenPayload: {
        gty: 'client-credentials',
      },
    });

    expect(result).toEqual({
      tcBillingAccountId: '12',
      markup: 0.58,
      active: true,
    });
  });

  it('falls back to project billingAccountId when Salesforce billing lookup is empty', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      billingAccountId: BigInt(12),
    });
    billingAccountServiceMock.getDefaultBillingAccount.mockResolvedValue(null);

    const result = await service.getProjectBillingAccount('1001', {
      userId: '123',
      isMachine: false,
    });

    expect(result).toEqual({
      tcBillingAccountId: '12',
    });
    expect(
      billingAccountServiceMock.getDefaultBillingAccount,
    ).toHaveBeenCalledWith('12');
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

  it('normalizes stored work-management permissions for project permission responses', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      templateId: BigInt(501),
    });
    prismaMock.projectMember.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        projectId: BigInt(1001),
        userId: BigInt(100),
        role: 'manager',
        isPrimary: true,
        deletedAt: null,
      },
    ]);
    prismaMock.workManagementPermission.findMany.mockResolvedValue([
      {
        policy: 'manage_team',
        permission: {
          allow: {
            roles: ['manager'],
          },
        },
      },
    ]);
    permissionServiceMock.hasPermission.mockReturnValue(true);

    const result = await service.getProjectPermissions('1001', {
      userId: '100',
      isMachine: false,
    });

    expect(result).toEqual({
      manage_team: true,
    });
    expect(permissionServiceMock.hasPermission).toHaveBeenCalledWith(
      {
        allowRule: {
          projectRoles: ['manager'],
        },
      },
      expect.objectContaining({ userId: '100' }),
      [
        expect.objectContaining({
          role: 'manager',
        }),
      ],
    );
  });

  it('returns a per-user permission matrix for machine tokens even without a template', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      templateId: null,
    });
    prismaMock.projectMember.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        projectId: BigInt(1001),
        userId: BigInt(100),
        role: 'manager',
        isPrimary: true,
        deletedAt: null,
      },
      {
        id: BigInt(2),
        projectId: BigInt(1001),
        userId: BigInt(200),
        role: 'customer',
        isPrimary: false,
        deletedAt: null,
      },
    ]);
    permissionServiceMock.isNamedPermissionRequireProjectMembers.mockImplementation(
      (permission: Permission) =>
        [Permission.VIEW_PROJECT, Permission.EDIT_PROJECT].includes(permission),
    );
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (
        permission: Permission,
        matrixUser: { userId?: string },
        members: any[],
      ) =>
        permission === Permission.VIEW_PROJECT ||
        (permission === Permission.EDIT_PROJECT &&
          matrixUser.userId === '100' &&
          members[0]?.role === 'manager'),
    );
    memberServiceMock.getUserRoles
      .mockResolvedValueOnce(['Connect Admin'])
      .mockResolvedValueOnce([]);

    const result = await service.getProjectPermissions('1001', {
      isMachine: true,
      scopes: [Scope.PROJECTS_READ],
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECTS_READ,
      },
    });

    expect(result).toEqual({
      '100': {
        memberships: [
          {
            memberId: '1',
            role: 'manager',
            isPrimary: true,
          },
        ],
        topcoderRoles: ['Connect Admin'],
        projectPermissions: {
          VIEW_PROJECT: true,
          EDIT_PROJECT: true,
        },
        workManagementPolicies: {},
      },
      '200': {
        memberships: [
          {
            memberId: '2',
            role: 'customer',
            isPrimary: false,
          },
        ],
        topcoderRoles: [],
        projectPermissions: {
          VIEW_PROJECT: true,
        },
        workManagementPolicies: {},
      },
    });
    expect(prismaMock.workManagementPermission.findMany).not.toHaveBeenCalled();
    expect(memberServiceMock.getUserRoles).toHaveBeenCalledWith('100');
    expect(memberServiceMock.getUserRoles).toHaveBeenCalledWith('200');
  });

  it.each([
    [
      'administrator',
      {
        userId: '999',
        roles: [UserRole.TOPCODER_ADMIN],
        isMachine: false,
      },
    ],
    [
      'project manager',
      {
        userId: '999',
        roles: [UserRole.PROJECT_MANAGER],
        isMachine: false,
      },
    ],
    [
      'talent manager',
      {
        userId: '999',
        roles: [UserRole.TALENT_MANAGER],
        isMachine: false,
      },
    ],
    [
      'topcoder talent manager',
      {
        userId: '999',
        roles: [UserRole.TOPCODER_TALENT_MANAGER],
        isMachine: false,
      },
    ],
  ])(
    'returns a per-user permission matrix for %s callers on all projects',
    async (
      _label: string,
      caller: {
        userId: string;
        roles: string[];
        isMachine: boolean;
      },
    ) => {
      prismaMock.project.findFirst.mockResolvedValue({
        templateId: null,
      });
      prismaMock.projectMember.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          projectId: BigInt(1001),
          userId: BigInt(100),
          role: 'manager',
          isPrimary: true,
          deletedAt: null,
        },
        {
          id: BigInt(2),
          projectId: BigInt(1001),
          userId: BigInt(200),
          role: 'customer',
          isPrimary: false,
          deletedAt: null,
        },
      ]);
      permissionServiceMock.isNamedPermissionRequireProjectMembers.mockImplementation(
        (permission: Permission) =>
          [Permission.VIEW_PROJECT, Permission.EDIT_PROJECT].includes(
            permission,
          ),
      );
      permissionServiceMock.hasNamedPermission.mockImplementation(
        (
          permission: Permission,
          _matrixUser: { userId?: string },
          members: any[],
        ) =>
          permission === Permission.VIEW_PROJECT ||
          (permission === Permission.EDIT_PROJECT &&
            members[0]?.role === 'manager'),
      );
      memberServiceMock.getUserRoles.mockResolvedValue([]);

      const result = await service.getProjectPermissions('1001', caller);

      expect(result).toEqual({
        '100': {
          memberships: [
            {
              memberId: '1',
              role: 'manager',
              isPrimary: true,
            },
          ],
          topcoderRoles: [],
          projectPermissions: {
            VIEW_PROJECT: true,
            EDIT_PROJECT: true,
          },
          workManagementPolicies: {},
        },
        '200': {
          memberships: [
            {
              memberId: '2',
              role: 'customer',
              isPrimary: false,
            },
          ],
          topcoderRoles: [],
          projectPermissions: {
            VIEW_PROJECT: true,
          },
          workManagementPolicies: {},
        },
      });
      expect(
        prismaMock.workManagementPermission.findMany,
      ).not.toHaveBeenCalled();
      expect(memberServiceMock.getUserRoles).toHaveBeenCalledWith('100');
      expect(memberServiceMock.getUserRoles).toHaveBeenCalledWith('200');
    },
  );

  it('returns a per-user permission matrix for copilot members on the requested project', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      templateId: null,
    });
    prismaMock.projectMember.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        projectId: BigInt(1001),
        userId: BigInt(100),
        role: 'manager',
        isPrimary: true,
        deletedAt: null,
      },
      {
        id: BigInt(3),
        projectId: BigInt(1001),
        userId: BigInt(300),
        role: 'copilot',
        isPrimary: false,
        deletedAt: null,
      },
    ]);
    permissionServiceMock.isNamedPermissionRequireProjectMembers.mockImplementation(
      (permission: Permission) =>
        [Permission.VIEW_PROJECT, Permission.EDIT_PROJECT].includes(permission),
    );
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (
        permission: Permission,
        _matrixUser: { userId?: string },
        members: any[],
      ) =>
        permission === Permission.VIEW_PROJECT ||
        (permission === Permission.EDIT_PROJECT &&
          ['manager', 'copilot'].includes(members[0]?.role)),
    );
    memberServiceMock.getUserRoles.mockResolvedValue([]);

    const result = await service.getProjectPermissions('1001', {
      userId: '300',
      roles: [UserRole.TOPCODER_USER],
      isMachine: false,
    });

    expect(result).toEqual({
      '100': {
        memberships: [
          {
            memberId: '1',
            role: 'manager',
            isPrimary: true,
          },
        ],
        topcoderRoles: [],
        projectPermissions: {
          VIEW_PROJECT: true,
          EDIT_PROJECT: true,
        },
        workManagementPolicies: {},
      },
      '300': {
        memberships: [
          {
            memberId: '3',
            role: 'copilot',
            isPrimary: false,
          },
        ],
        topcoderRoles: [],
        projectPermissions: {
          VIEW_PROJECT: true,
          EDIT_PROJECT: true,
        },
        workManagementPolicies: {},
      },
    });
    expect(prismaMock.workManagementPermission.findMany).not.toHaveBeenCalled();
    expect(memberServiceMock.getUserRoles).toHaveBeenCalledWith('100');
    expect(memberServiceMock.getUserRoles).toHaveBeenCalledWith('300');
  });

  it('creates projects for machine principals inferred from token claims without creating a synthetic owner member', async () => {
    const transactionProjectCreate = jest.fn().mockResolvedValue({
      id: BigInt(1001),
      status: 'in_review',
    });
    const transactionProjectMemberCreate = jest.fn().mockResolvedValue({});
    const transactionProjectHistoryCreate = jest.fn().mockResolvedValue({});

    prismaMock.projectType.findFirst.mockResolvedValue({
      key: 'app',
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            create: transactionProjectCreate,
          },
          projectMember: {
            create: transactionProjectMemberCreate,
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          projectHistory: {
            create: transactionProjectHistoryCreate,
          },
        }),
    );
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Machine Project',
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
      utm: null,
      details: null,
      challengeEligibility: null,
      cancelReason: null,
      templateId: null,
      version: 'v3',
      lastActivityAt: new Date(),
      lastActivityUserId: 'svc-projects',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: -1,
      updatedBy: -1,
      members: [],
      invites: [],
      attachments: [],
      phases: [],
    });
    permissionServiceMock.hasNamedPermission.mockReturnValue(false);

    const result = await service.createProject(
      {
        name: 'Machine Project',
        type: 'app',
      },
      {
        isMachine: false,
        scopes: ['write:projects'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:projects',
          sub: 'svc-projects',
        },
      },
    );

    expect(result.id).toBe('1001');
    expect(result).toMatchObject({
      billingAccount: null,
      client: null,
      relatedBillingAccounts: [],
    });
    expect(transactionProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastActivityUserId: 'svc-projects',
          createdBy: -1,
          updatedBy: -1,
        }),
      }),
    );
    expect(transactionProjectMemberCreate).not.toHaveBeenCalled();
    expect(transactionProjectHistoryCreate).toHaveBeenCalled();
  });

  it('assigns Talent Manager creators the manager project role', async () => {
    const transactionProjectCreate = jest.fn().mockResolvedValue({
      id: BigInt(1001),
      status: 'in_review',
    });
    const transactionProjectMemberCreate = jest.fn().mockResolvedValue({});
    const transactionProjectHistoryCreate = jest.fn().mockResolvedValue({});

    prismaMock.projectType.findFirst.mockResolvedValue({
      key: 'app',
    });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            create: transactionProjectCreate,
          },
          projectMember: {
            create: transactionProjectMemberCreate,
            createMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          projectHistory: {
            create: transactionProjectHistoryCreate,
          },
        }),
    );
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Talent Managed Project',
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
      utm: null,
      details: null,
      challengeEligibility: null,
      cancelReason: null,
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
          userId: BigInt(100),
          role: 'manager',
          deletedAt: null,
        },
      ],
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
        name: 'Talent Managed Project',
        type: 'app',
      },
      {
        userId: '100',
        roles: [UserRole.TALENT_MANAGER],
        isMachine: false,
      },
    );

    expect(transactionProjectMemberCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: BigInt(100),
        role: 'manager',
        isPrimary: true,
      }),
    });
    expect(transactionProjectHistoryCreate).toHaveBeenCalled();
  });

  it('updates projects for machine principals inferred from token claims using fallback audit identity', async () => {
    const transactionUpdate = jest.fn().mockResolvedValue({
      id: BigInt(1001),
      name: 'Updated by machine',
      status: 'active',
      billingAccountId: null,
      directProjectId: null,
    });

    prismaMock.project.findFirst
      .mockResolvedValueOnce({
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'in_review',
        billingAccountId: null,
        directProjectId: null,
        details: {},
        bookmarks: null,
        members: [],
        invites: [],
      })
      .mockResolvedValueOnce({
        id: BigInt(1001),
        name: 'Updated by machine',
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
        details: {},
        challengeEligibility: null,
        templateId: null,
        version: 'v3',
        lastActivityAt: new Date(),
        lastActivityUserId: 'svc-projects',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: -1,
        updatedBy: -1,
        members: [],
        invites: [],
        attachments: [],
        phases: [],
      });
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            update: transactionUpdate,
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
        name: 'Updated by machine',
        status: 'active',
      },
      {
        isMachine: false,
        scopes: ['write:projects'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:projects',
          sub: 'svc-projects',
        },
      },
    );

    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastActivityUserId: 'svc-projects',
          updatedBy: -1,
        }),
      }),
    );
  });

  it('deletes projects for machine principals inferred from token claims using fallback audit identity', async () => {
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [],
    });
    prismaMock.project.update.mockResolvedValue({
      id: BigInt(1001),
    });
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.DELETE_PROJECT,
    );

    await service.deleteProject('1001', {
      isMachine: false,
      scopes: ['write:projects'],
      tokenPayload: {
        gty: 'client-credentials',
        scope: 'write:projects',
        sub: 'svc-projects',
      },
    });

    expect(prismaMock.project.update).toHaveBeenCalledWith({
      where: {
        id: BigInt(1001),
      },
      data: {
        deletedAt: expect.any(Date),
        deletedBy: BigInt(-1),
        updatedBy: -1,
      },
    });
    expect(eventUtils.publishProjectEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_DELETED,
      {
        id: '1001',
        deletedBy: 'svc-projects',
      },
    );
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

  it('clears billing account id when explicitly requested', async () => {
    const transactionUpdate = jest.fn().mockResolvedValue({
      id: BigInt(1001),
    });

    prismaMock.project.findFirst
      .mockResolvedValueOnce({
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'in_review',
        billingAccountId: BigInt(12),
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
        status: 'in_review',
        billingAccountId: null,
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
        members: [],
        invites: [],
        attachments: [],
        phases: [],
      });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            update: transactionUpdate,
          },
          projectHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.EDIT_PROJECT) {
          return true;
        }

        if (permission === Permission.MANAGE_PROJECT_BILLING_ACCOUNT_ID) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_ANY) {
          return true;
        }

        return true;
      },
    );

    await service.updateProject(
      '1001',
      {
        billingAccountId: null,
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingAccountId: null,
        }),
      }),
    );
  });

  it('does not require billing account manage permission when clearing an already-empty billing account', async () => {
    const transactionUpdate = jest.fn().mockResolvedValue({
      id: BigInt(1001),
    });

    prismaMock.project.findFirst
      .mockResolvedValueOnce({
        id: BigInt(1001),
        name: 'Demo',
        description: null,
        type: 'app',
        status: 'in_review',
        billingAccountId: null,
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
        status: 'in_review',
        billingAccountId: null,
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
        members: [],
        invites: [],
        attachments: [],
        phases: [],
      });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            update: transactionUpdate,
          },
          projectHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.EDIT_PROJECT) {
          return true;
        }

        if (permission === Permission.MANAGE_PROJECT_BILLING_ACCOUNT_ID) {
          return false;
        }

        if (permission === Permission.READ_PROJECT_ANY) {
          return true;
        }

        return true;
      },
    );

    await expect(
      service.updateProject(
        '1001',
        {
          clearBillingAccountId: true,
        } as any,
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).resolves.toBeDefined();

    expect(
      permissionServiceMock.hasNamedPermission.mock.calls.some(
        ([permission]: [Permission]) =>
          permission === Permission.MANAGE_PROJECT_BILLING_ACCOUNT_ID,
      ),
    ).toBe(false);
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billingAccountId: null,
        }),
      }),
    );
  });

  it('persists cancelReason and project-history cancelReason on cancellation updates', async () => {
    const transactionUpdate = jest.fn().mockResolvedValue({
      id: BigInt(1001),
    });
    const transactionHistoryCreate = jest.fn().mockResolvedValue({});

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
        status: 'cancelled',
        cancelReason: 'Client requested cancellation',
        billingAccountId: null,
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
        members: [],
        invites: [],
        attachments: [],
        phases: [],
      });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          project: {
            update: transactionUpdate,
          },
          projectHistory: {
            create: transactionHistoryCreate,
          },
        }),
    );

    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.EDIT_PROJECT) {
          return true;
        }

        if (permission === Permission.MANAGE_PROJECT_BILLING_ACCOUNT_ID) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_ANY) {
          return true;
        }

        return true;
      },
    );

    await service.updateProject(
      '1001',
      {
        status: 'cancelled',
        cancelReason: 'Client requested cancellation',
        clearBillingAccountId: true,
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'cancelled',
          cancelReason: 'Client requested cancellation',
          billingAccountId: null,
        }),
      }),
    );
    expect(transactionHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'cancelled',
          cancelReason: 'Client requested cancellation',
        }),
      }),
    );
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
              name: 'Demo',
              status: 'active',
              billingAccountId: BigInt(22),
              directProjectId: null,
            }),
          },
          projectHistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
    );
    permissionServiceMock.hasNamedPermission.mockReturnValue(true);

    const currentAccount = {
      tcBillingAccountId: '22',
      costCenter: 'New contract',
      client: { id: 'client-1', name: 'Acme' },
    };
    const previousAccount = {
      tcBillingAccountId: '11',
      costCenter: 'Previous contract',
    };
    billingAccountServiceMock.getBillingAccountsByIds.mockResolvedValue({
      '22': currentAccount,
      '11': previousAccount,
    });
    challengeFindMany.mockResolvedValue([
      { projectId: 1001, billingRecord: { billingAccountId: '11' } },
    ]);

    const result = await service.updateProject(
      '1001',
      {
        status: 'active',
        billingAccountId: 22,
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(result.billingAccount).toEqual(currentAccount);
    expect(result.client).toEqual(currentAccount.client);
    expect(result.relatedBillingAccounts).toEqual([previousAccount]);
    expect(eventUtils.publishProjectEvent.mock.calls[0][1]).not.toHaveProperty(
      'relatedBillingAccounts',
    );
    expect(eventUtils.publishProjectEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_UPDATED,
      expect.any(Object),
    );
    expect(eventUtils.publishRawEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_BILLING_ACCOUNT_UPDATED,
      {
        projectId: '1001',
        projectName: 'Demo',
        directProjectId: null,
        status: 'active',
        oldBillingAccountId: '11',
        newBillingAccountId: '22',
      },
    );
  });

  it('does not publish billing-account update event when billingAccountId is unchanged', async () => {
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
        name: 'Demo Updated',
        description: null,
        type: 'app',
        status: 'active',
        billingAccountId: BigInt(11),
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
              name: 'Demo Updated',
              status: 'active',
              billingAccountId: BigInt(11),
              directProjectId: null,
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
        status: 'active',
        name: 'Demo Updated',
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
    expect(eventUtils.publishRawEvent).not.toHaveBeenCalled();
  });
});
