import { ProjectStatus, TimelineReference } from '@prisma/client';
import { MilestoneService } from './milestone.service';

function buildTimeline(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    name: 'Execution',
    description: null,
    startDate: new Date('2026-02-01T00:00:00.000Z'),
    endDate: null,
    reference: TimelineReference.project,
    referenceId: BigInt(1001),
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    ...overrides,
  };
}

function buildMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(11),
    timelineId: BigInt(1),
    name: 'Kickoff',
    description: null,
    duration: 2,
    startDate: new Date('2026-02-01T00:00:00.000Z'),
    actualStartDate: null,
    endDate: new Date('2026-02-02T00:00:00.000Z'),
    completionDate: null,
    status: ProjectStatus.reviewed,
    type: 'phase',
    details: {},
    order: 1,
    plannedText: 'planned',
    activeText: 'active',
    completedText: 'completed',
    blockedText: 'blocked',
    hidden: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    statusHistory: [
      {
        id: BigInt(1),
        reference: 'milestone',
        referenceId: BigInt(11),
        status: ProjectStatus.reviewed,
        comment: null,
        createdBy: 123,
        createdAt: new Date(),
        updatedBy: 123,
        updatedAt: new Date(),
      },
    ],
    ...overrides,
  };
}

describe('MilestoneService', () => {
  const prismaMock = {
    timeline: {
      findFirst: jest.fn(),
    },
    milestone: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const timelineReferenceServiceMock = {
    resolveProjectContextByTimelineId: jest.fn(),
  };

  let service: MilestoneService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MilestoneService(
      prismaMock as any,
      timelineReferenceServiceMock as any,
    );

    prismaMock.timeline.findFirst.mockResolvedValue(buildTimeline());
    prismaMock.milestone.findMany.mockResolvedValue([]);
    timelineReferenceServiceMock.resolveProjectContextByTimelineId.mockResolvedValue(
      {
        projectId: BigInt(1001),
      },
    );
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo Project',
      details: {},
    });
  });

  it('creates milestone with order shift and status history entry', async () => {
    const txMilestoneCount = jest.fn().mockResolvedValue(2);
    const txMilestoneUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const txMilestoneCreate = jest.fn().mockResolvedValue(
      buildMilestone({
        id: BigInt(55),
        order: 1,
      }),
    );
    const txStatusHistoryCreate = jest.fn().mockResolvedValue({});

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          milestone: {
            count: txMilestoneCount,
            updateMany: txMilestoneUpdateMany,
            create: txMilestoneCreate,
          },
          statusHistory: {
            create: txStatusHistoryCreate,
          },
        }),
    );

    prismaMock.milestone.findFirst.mockResolvedValue(
      buildMilestone({
        id: BigInt(55),
        order: 1,
      }),
    );

    const response = await service.createMilestone(
      '1',
      {
        name: 'Kickoff',
        duration: 2,
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        status: ProjectStatus.reviewed,
        type: 'phase',
        order: 1,
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(response.id).toBe('55');
    expect(txMilestoneUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          order: {
            gte: 1,
          },
        }),
      }),
    );
    expect(txStatusHistoryCreate).toHaveBeenCalled();
  });

  it('bulk updates milestones with create, update and delete operations', async () => {
    const existingMilestones = [
      buildMilestone({ id: BigInt(11), order: 1 }),
      buildMilestone({
        id: BigInt(12),
        order: 2,
        status: ProjectStatus.active,
        statusHistory: [
          {
            id: BigInt(2),
            reference: 'milestone',
            referenceId: BigInt(12),
            status: ProjectStatus.active,
            comment: null,
            createdBy: 123,
            createdAt: new Date(),
            updatedBy: 123,
            updatedAt: new Date(),
          },
        ],
      }),
    ];

    const txMilestoneFindMany = jest
      .fn()
      .mockResolvedValueOnce(existingMilestones)
      .mockResolvedValueOnce([
        {
          id: BigInt(11),
          order: 1,
        },
        {
          id: BigInt(99),
          order: 9,
        },
      ])
      .mockResolvedValueOnce([
        buildMilestone({
          id: BigInt(11),
          order: 1,
          status: ProjectStatus.completed,
          statusHistory: [
            {
              id: BigInt(3),
              reference: 'milestone',
              referenceId: BigInt(11),
              status: ProjectStatus.completed,
              comment: 'done',
              createdBy: 123,
              createdAt: new Date(),
              updatedBy: 123,
              updatedAt: new Date(),
            },
          ],
        }),
        buildMilestone({
          id: BigInt(99),
          order: 2,
          name: 'New Milestone',
        }),
      ]);

    const txMilestoneUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const txMilestoneUpdate = jest.fn().mockResolvedValue(
      buildMilestone({
        id: BigInt(11),
        status: ProjectStatus.completed,
      }),
    );
    const txMilestoneCreate = jest.fn().mockResolvedValue(
      buildMilestone({
        id: BigInt(99),
        order: 9,
        name: 'New Milestone',
      }),
    );
    const txMilestoneFindFirst = jest.fn().mockResolvedValueOnce(
      buildMilestone({
        id: BigInt(11),
        status: ProjectStatus.completed,
        statusHistory: [
          {
            id: BigInt(3),
            reference: 'milestone',
            referenceId: BigInt(11),
            status: ProjectStatus.completed,
            comment: 'done',
            createdBy: 123,
            createdAt: new Date(),
            updatedBy: 123,
            updatedAt: new Date(),
          },
        ],
      }),
    );
    const txStatusHistoryCreate = jest.fn().mockResolvedValue({});

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          milestone: {
            findMany: txMilestoneFindMany,
            updateMany: txMilestoneUpdateMany,
            update: txMilestoneUpdate,
            create: txMilestoneCreate,
            findFirst: txMilestoneFindFirst,
          },
          statusHistory: {
            create: txStatusHistoryCreate,
          },
        }),
    );

    const response = await service.bulkUpdateMilestones(
      '1',
      [
        {
          id: 11,
          status: ProjectStatus.completed,
          statusComment: 'done',
          order: 1,
        },
        {
          name: 'New Milestone',
          duration: 1,
          startDate: new Date('2026-02-03T00:00:00.000Z'),
          status: ProjectStatus.reviewed,
          type: 'phase',
          order: 2,
        },
      ],
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(response).toHaveLength(2);
    expect(txMilestoneUpdateMany).toHaveBeenCalled();
    expect(txMilestoneCreate).toHaveBeenCalled();
    expect(txMilestoneUpdate).toHaveBeenCalled();
    expect(txStatusHistoryCreate).toHaveBeenCalled();
  });
});
