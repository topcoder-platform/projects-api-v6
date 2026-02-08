import { ProjectStatus, TimelineReference } from '@prisma/client';
import { TimelineService } from './timeline.service';

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
    deletedBy: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    statusHistory: [],
    ...overrides,
  };
}

function buildTimeline(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    name: 'Execution',
    description: null,
    startDate: new Date('2026-02-01T00:00:00.000Z'),
    endDate: new Date('2026-02-28T00:00:00.000Z'),
    reference: TimelineReference.project,
    referenceId: BigInt(1001),
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    milestones: [buildMilestone()],
    ...overrides,
  };
}

describe('TimelineService', () => {
  const prismaMock = {
    timeline: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const referenceServiceMock = {
    resolveProjectContextByReference: jest.fn(),
  };

  let service: TimelineService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TimelineService(
      prismaMock as any,
      referenceServiceMock as any,
    );
  });

  it('creates timeline and bootstraps milestones from template with status history', async () => {
    const txTimelineCreate = jest.fn().mockResolvedValue({
      id: BigInt(1),
      startDate: new Date('2026-02-01T00:00:00.000Z'),
      name: 'Execution',
      description: null,
      endDate: null,
      reference: TimelineReference.project,
      referenceId: BigInt(1001),
      deletedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedBy: null,
      createdBy: BigInt(123),
      updatedBy: BigInt(123),
    });
    const txTemplateFindMany = jest.fn().mockResolvedValue([
      {
        id: BigInt(9),
        name: 'Template A',
        description: 'A',
        duration: 2,
        type: 'phase',
        order: 1,
        plannedText: 'planned',
        activeText: 'active',
        completedText: 'completed',
        blockedText: 'blocked',
        hidden: false,
        metadata: { key: 'value' },
      },
      {
        id: BigInt(10),
        name: 'Template B',
        description: 'B',
        duration: 1,
        type: 'phase',
        order: 2,
        plannedText: 'planned2',
        activeText: 'active2',
        completedText: 'completed2',
        blockedText: 'blocked2',
        hidden: false,
        metadata: { key: 'value-2' },
      },
    ]);
    const txMilestoneCreate = jest
      .fn()
      .mockResolvedValueOnce(
        buildMilestone({
          id: BigInt(200),
          name: 'Template A',
          startDate: new Date('2026-02-01T00:00:00.000Z'),
          endDate: new Date('2026-02-02T00:00:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(
        buildMilestone({
          id: BigInt(201),
          name: 'Template B',
          order: 2,
          startDate: new Date('2026-02-03T00:00:00.000Z'),
          endDate: new Date('2026-02-03T00:00:00.000Z'),
        }),
      );
    const txStatusHistoryCreate = jest.fn().mockResolvedValue({});

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          timeline: {
            create: txTimelineCreate,
          },
          milestoneTemplate: {
            findMany: txTemplateFindMany,
          },
          milestone: {
            create: txMilestoneCreate,
          },
          statusHistory: {
            create: txStatusHistoryCreate,
          },
        }),
    );

    prismaMock.timeline.findFirst.mockResolvedValue(
      buildTimeline({
        milestones: [
          buildMilestone({
            id: BigInt(200),
            name: 'Template A',
            statusHistory: [
              {
                id: BigInt(1),
                reference: 'milestone',
                referenceId: BigInt(200),
                status: ProjectStatus.reviewed,
                comment: null,
                createdBy: 123,
                createdAt: new Date(),
                updatedBy: 123,
                updatedAt: new Date(),
              },
            ],
          }),
          buildMilestone({
            id: BigInt(201),
            name: 'Template B',
            order: 2,
            statusHistory: [
              {
                id: BigInt(2),
                reference: 'milestone',
                referenceId: BigInt(201),
                status: ProjectStatus.reviewed,
                comment: null,
                createdBy: 123,
                createdAt: new Date(),
                updatedBy: 123,
                updatedAt: new Date(),
              },
            ],
          }),
        ],
      }),
    );

    referenceServiceMock.resolveProjectContextByReference.mockResolvedValue({
      projectId: BigInt(1001),
    });

    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo Project',
      details: {
        utm: {
          code: 'ABC',
        },
      },
    });

    const response = await service.createTimeline(
      {
        name: 'Execution',
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        reference: TimelineReference.project,
        referenceId: 1001,
        templateId: 67,
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(response.id).toBe('1');
    expect(txMilestoneCreate).toHaveBeenCalledTimes(2);
    expect(txStatusHistoryCreate).toHaveBeenCalledTimes(2);
  });

  it('updates timeline startDate and cascades milestone schedule updates', async () => {
    prismaMock.timeline.findFirst
      .mockResolvedValueOnce(
        buildTimeline({
          startDate: new Date('2026-02-01T00:00:00.000Z'),
          milestones: [
            buildMilestone({
              id: BigInt(11),
              duration: 2,
              startDate: new Date('2026-02-01T00:00:00.000Z'),
              endDate: new Date('2026-02-02T00:00:00.000Z'),
            }),
            buildMilestone({
              id: BigInt(12),
              order: 2,
              duration: 3,
              startDate: new Date('2026-02-03T00:00:00.000Z'),
              endDate: new Date('2026-02-05T00:00:00.000Z'),
            }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        buildTimeline({
          startDate: new Date('2026-02-10T00:00:00.000Z'),
          milestones: [
            buildMilestone({
              id: BigInt(11),
              duration: 2,
              startDate: new Date('2026-02-10T00:00:00.000Z'),
              endDate: new Date('2026-02-11T00:00:00.000Z'),
            }),
            buildMilestone({
              id: BigInt(12),
              order: 2,
              duration: 3,
              startDate: new Date('2026-02-12T00:00:00.000Z'),
              endDate: new Date('2026-02-14T00:00:00.000Z'),
            }),
          ],
        }),
      );

    const txTimelineUpdate = jest.fn().mockResolvedValue({});
    const txMilestoneFindMany = jest.fn().mockResolvedValue([
      buildMilestone({
        id: BigInt(11),
        duration: 2,
        startDate: new Date('2026-02-01T00:00:00.000Z'),
        endDate: new Date('2026-02-02T00:00:00.000Z'),
      }),
      buildMilestone({
        id: BigInt(12),
        order: 2,
        duration: 3,
        startDate: new Date('2026-02-03T00:00:00.000Z'),
        endDate: new Date('2026-02-05T00:00:00.000Z'),
      }),
    ]);
    const txMilestoneUpdate = jest.fn().mockResolvedValue({});

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          timeline: {
            update: txTimelineUpdate,
          },
          milestone: {
            findMany: txMilestoneFindMany,
            update: txMilestoneUpdate,
          },
        }),
    );

    referenceServiceMock.resolveProjectContextByReference.mockResolvedValue({
      projectId: BigInt(1001),
    });

    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      name: 'Demo Project',
      details: {},
    });

    const response = await service.updateTimeline(
      '1',
      {
        startDate: new Date('2026-02-10T00:00:00.000Z'),
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(response.startDate.toISOString()).toBe('2026-02-10T00:00:00.000Z');
    expect(txMilestoneUpdate).toHaveBeenCalledTimes(2);
  });
});
