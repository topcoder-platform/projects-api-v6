import { NotFoundException } from '@nestjs/common';
import { PlanConfigService } from './plan-config.service';

function buildPlanConfigRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    key: 'design',
    version: BigInt(1),
    revision: BigInt(1),
    config: { phases: [] },
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: 123,
    updatedBy: 123,
    ...overrides,
  };
}

describe('PlanConfigService', () => {
  const prisma = {
    planConfig: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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

  let service: PlanConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlanConfigService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates a new plan config version with auto-incremented version', async () => {
    prisma.planConfig.findFirst.mockResolvedValue({ version: BigInt(4) });
    prisma.planConfig.create.mockResolvedValue(
      buildPlanConfigRecord({
        id: BigInt(10),
        version: BigInt(5),
      }),
    );

    const result = await service.createVersion('design', { config: true }, 321);

    expect(prisma.planConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'design',
          version: BigInt(5),
          revision: BigInt(1),
          createdBy: 321,
          updatedBy: 321,
        }),
      }),
    );
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
    expect(result.version).toBe('5');
  });

  it('throws not found for missing version lookup', async () => {
    prisma.planConfig.findFirst.mockResolvedValue(null);

    await expect(
      service.findLatestRevisionOfVersion('design', BigInt(1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
