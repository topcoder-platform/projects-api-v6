import { NotFoundException } from '@nestjs/common';
import { MilestoneTemplateService } from './milestone-template.service';

function buildMilestoneTemplateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    name: 'Kickoff',
    description: 'desc',
    duration: 2,
    type: 'phase',
    order: 1,
    plannedText: 'planned',
    activeText: 'active',
    completedText: 'completed',
    blockedText: 'blocked',
    hidden: false,
    reference: 'project',
    referenceId: BigInt(1001),
    metadata: {},
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    ...overrides,
  };
}

describe('MilestoneTemplateService', () => {
  const prisma = {
    milestoneTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const prismaErrorService = {
    handleError: jest.fn((error: Error) => {
      throw error;
    }),
  };

  const eventBusService = {
    publishProjectEvent: jest.fn().mockResolvedValue(undefined),
  };

  let service: MilestoneTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MilestoneTemplateService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates milestone template and publishes event', async () => {
    prisma.milestoneTemplate.create.mockResolvedValue(
      buildMilestoneTemplateRecord(),
    );

    const result = await service.create(
      {
        name: 'Kickoff',
        duration: 2,
        type: 'phase',
        order: 1,
        plannedText: 'planned',
        activeText: 'active',
        completedText: 'completed',
        blockedText: 'blocked',
        reference: 'project',
        referenceId: 1001,
      },
      BigInt(123),
    );

    expect(result.id).toBe('1');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('clones milestone template', async () => {
    prisma.milestoneTemplate.findFirst.mockResolvedValue(
      buildMilestoneTemplateRecord(),
    );
    prisma.milestoneTemplate.create.mockResolvedValue(
      buildMilestoneTemplateRecord({ id: BigInt(2) }),
    );

    const result = await service.clone(
      {
        sourceMilestoneTemplateId: 1,
        reference: 'project',
        referenceId: 2002,
      },
      BigInt(123),
    );

    expect(result.id).toBe('2');
    expect(prisma.milestoneTemplate.create).toHaveBeenCalled();
  });

  it('throws not found when milestone template does not exist', async () => {
    prisma.milestoneTemplate.findFirst.mockResolvedValue(null);

    await expect(service.findOne(BigInt(999))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
