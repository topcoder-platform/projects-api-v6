import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Permission } from 'src/shared/constants/permissions';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectPhaseService } from './project-phase.service';

type TxPhaseOrder = {
  id: bigint;
  order: number | null;
};

function buildPhaseRecord(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: BigInt(11),
    projectId: BigInt(1001),
    name: 'Phase',
    description: null,
    requirements: null,
    status: 'active',
    startDate: null,
    endDate: null,
    duration: null,
    budget: 0,
    spentBudget: 0,
    progress: 0,
    details: {},
    order: 1,
    deletedAt: null,
    deletedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 100,
    updatedBy: 100,
    products: [],
    members: [],
    approvals: [],
    ...overrides,
  };
}

describe('ProjectPhaseService', () => {
  const prismaMock = {
    project: {
      findFirst: jest.fn(),
    },
    projectPhase: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    phaseProduct: {
      create: jest.fn(),
    },
    projectPhaseMember: {
      createMany: jest.fn(),
    },
    productTemplate: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  let service: ProjectPhaseService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ProjectPhaseService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
    );

    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      directProjectId: BigInt(77),
      billingAccountId: BigInt(88),
      members: [
        {
          userId: BigInt(100),
          role: 'manager',
          deletedAt: null,
        },
      ],
    });
  });

  it('lists phases with requested field filtering and memberOnly support', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.VIEW_PROJECT) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_ANY) {
          return false;
        }

        return false;
      },
    );

    prismaMock.projectPhase.findMany.mockResolvedValue([
      buildPhaseRecord({
        id: BigInt(11),
        name: 'Build',
        products: [
          {
            id: BigInt(1),
            phaseId: BigInt(11),
            projectId: BigInt(1001),
            directProjectId: null,
            billingAccountId: null,
            templateId: BigInt(0),
            name: 'Generic',
            type: 'generic',
            estimatedPrice: 1,
            actualPrice: 0,
            details: {},
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedBy: null,
            createdBy: 100,
            updatedBy: 100,
          },
        ],
      }),
    ]);

    const response = await service.listPhases(
      '1001',
      {
        fields: 'id,name,products',
        sort: 'order desc',
        memberOnly: true,
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(prismaMock.projectPhase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { order: 'desc' },
      }),
    );
    expect(response[0]).toEqual(
      expect.objectContaining({
        id: '11',
        name: 'Build',
        products: expect.any(Array),
      }),
    );
    expect(response[0].projectId).toBeUndefined();
  });

  it('creates phase with contiguous order and persists template details', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.ADD_PROJECT_PHASE,
    );

    const txProjectPhaseFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: BigInt(1), order: 1 },
        { id: BigInt(2), order: 3 },
      ] satisfies TxPhaseOrder[])
      .mockResolvedValueOnce([
        { id: BigInt(1), order: 1 },
        { id: BigInt(2), order: 3 },
        { id: BigInt(40), order: 3 },
      ] satisfies TxPhaseOrder[]);
    const txProjectPhaseCreate = jest.fn().mockResolvedValue({
      id: BigInt(40),
      projectId: BigInt(1001),
    });
    const txProjectPhaseUpdate = jest.fn().mockResolvedValue({});
    const txProductTemplateFindFirst = jest.fn().mockResolvedValue({
      id: BigInt(5),
      name: 'Template Product',
      productKey: 'challenge',
      category: 'development',
      subCategory: 'web',
      brief: 'brief',
      details: 'description',
      aliases: ['alias-a'],
      template: {
        challengeType: 'first2finish',
      },
      form: null,
    });
    const txPhaseProductCreate = jest.fn().mockResolvedValue({});
    const txProjectPhaseMemberCreateMany = jest
      .fn()
      .mockResolvedValue({ count: 2 });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          projectPhase: {
            findMany: txProjectPhaseFindMany,
            create: txProjectPhaseCreate,
            update: txProjectPhaseUpdate,
          },
          productTemplate: {
            findFirst: txProductTemplateFindFirst,
          },
          phaseProduct: {
            create: txPhaseProductCreate,
          },
          projectPhaseMember: {
            createMany: txProjectPhaseMemberCreateMany,
          },
        }),
    );

    prismaMock.projectPhase.findFirst.mockResolvedValue(
      buildPhaseRecord({
        id: BigInt(40),
        order: 3,
      }),
    );

    const response = await service.createPhase(
      '1001',
      {
        name: 'Kickoff',
        status: 'active' as any,
        productTemplateId: 5,
        members: [100, 200],
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(response.id).toBe('40');
    expect(txProjectPhaseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order: 3,
        }),
      }),
    );
    expect(txProjectPhaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(2) },
        data: expect.objectContaining({
          order: 2,
        }),
      }),
    );
    expect(txPhaseProductCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: {
            challengeType: 'first2finish',
          },
        }),
      }),
    );
  });

  it('reorders sibling phases when updating order', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.UPDATE_PROJECT_PHASE,
    );

    prismaMock.projectPhase.findFirst.mockResolvedValue(
      buildPhaseRecord({
        id: BigInt(11),
        order: 1,
        status: 'active',
      }),
    );

    const txProjectPhaseFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: BigInt(11), order: 1 },
        { id: BigInt(12), order: 2 },
        { id: BigInt(13), order: 3 },
      ] satisfies TxPhaseOrder[])
      .mockResolvedValueOnce([
        { id: BigInt(11), order: 1 },
        { id: BigInt(12), order: 2 },
        { id: BigInt(13), order: 3 },
      ] satisfies TxPhaseOrder[]);
    const txProjectPhaseUpdate = jest.fn().mockImplementation((args: any) => {
      if (args.where.id === BigInt(12)) {
        return Promise.resolve(buildPhaseRecord({ id: BigInt(12), order: 1 }));
      }

      if (args.where.id === BigInt(13)) {
        return Promise.resolve(buildPhaseRecord({ id: BigInt(13), order: 2 }));
      }

      return Promise.resolve(
        buildPhaseRecord({
          id: BigInt(11),
          order: 3,
          name: args.data.name || 'Phase',
        }),
      );
    });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          projectPhase: {
            findMany: txProjectPhaseFindMany,
            update: txProjectPhaseUpdate,
          },
        }),
    );

    const response = await service.updatePhase(
      '1001',
      '11',
      {
        name: 'Moved',
        order: 3,
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(response.order).toBe(3);
    expect(txProjectPhaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(12) },
        data: expect.objectContaining({
          order: 1,
        }),
      }),
    );
    expect(txProjectPhaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(13) },
        data: expect.objectContaining({
          order: 2,
        }),
      }),
    );
    expect(txProjectPhaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(11) },
        data: expect.objectContaining({
          order: 3,
        }),
      }),
    );
  });

  it('fails update when startDate is after endDate', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.UPDATE_PROJECT_PHASE,
    );

    prismaMock.projectPhase.findFirst.mockResolvedValue({
      id: BigInt(11),
      projectId: BigInt(1001),
      startDate: null,
      endDate: null,
      status: 'active',
    });

    await expect(
      service.updatePhase(
        '1001',
        '11',
        {
          startDate: new Date('2026-01-03T00:00:00.000Z'),
          endDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid status transitions from terminal statuses', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.UPDATE_PROJECT_PHASE,
    );

    prismaMock.projectPhase.findFirst.mockResolvedValue(
      buildPhaseRecord({
        id: BigInt(11),
        status: 'completed',
      }),
    );

    await expect(
      service.updatePhase(
        '1001',
        '11',
        {
          status: 'active' as any,
        },
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('soft deletes phase and closes order gaps', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean =>
        permission === Permission.DELETE_PROJECT_PHASE,
    );

    prismaMock.projectPhase.findFirst.mockResolvedValue(
      buildPhaseRecord({
        id: BigInt(11),
        order: 2,
      }),
    );

    const txProjectPhaseFindMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: BigInt(12), order: 2 },
        { id: BigInt(13), order: 4 },
      ] satisfies TxPhaseOrder[])
      .mockResolvedValueOnce([
        { id: BigInt(12), order: 2 },
        { id: BigInt(13), order: 4 },
      ] satisfies TxPhaseOrder[]);
    const txProjectPhaseUpdate = jest.fn().mockImplementation((args: any) => {
      if (args.where.id === BigInt(11)) {
        return Promise.resolve(
          buildPhaseRecord({
            id: BigInt(11),
            deletedAt: new Date(),
            deletedBy: 100,
            order: 2,
          }),
        );
      }

      return Promise.resolve(
        buildPhaseRecord({
          id: args.where.id,
          order: args.data.order,
        }),
      );
    });

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          projectPhase: {
            findMany: txProjectPhaseFindMany,
            update: txProjectPhaseUpdate,
          },
        }),
    );

    await service.deletePhase('1001', '11', {
      userId: '100',
      isMachine: false,
    });

    expect(txProjectPhaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(12) },
        data: expect.objectContaining({
          order: 1,
        }),
      }),
    );
    expect(txProjectPhaseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(13) },
        data: expect.objectContaining({
          order: 2,
        }),
      }),
    );
  });

  it('throws forbidden when user cannot create phase', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(false);

    await expect(
      service.createPhase(
        '1001',
        {
          name: 'Blocked',
          status: 'active' as any,
        },
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
