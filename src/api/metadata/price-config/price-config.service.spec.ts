import { NotFoundException } from '@nestjs/common';
import { PriceConfigService } from './price-config.service';

function buildPriceConfigRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    key: 'design',
    version: BigInt(1),
    revision: BigInt(1),
    config: { pricing: [] },
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: 123,
    updatedBy: 123,
    ...overrides,
  };
}

describe('PriceConfigService', () => {
  const prisma = {
    priceConfig: {
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

  let service: PriceConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PriceConfigService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates a new price config revision with incremented revision', async () => {
    prisma.priceConfig.findFirst.mockResolvedValue(
      buildPriceConfigRecord({
        version: BigInt(2),
        revision: BigInt(4),
      }),
    );
    prisma.priceConfig.create.mockResolvedValue(
      buildPriceConfigRecord({
        id: BigInt(11),
        version: BigInt(2),
        revision: BigInt(5),
      }),
    );

    const result = await service.createRevision(
      'design',
      BigInt(2),
      { config: true },
      321,
    );

    expect(prisma.priceConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'design',
          version: BigInt(2),
          revision: BigInt(5),
          createdBy: 321,
          updatedBy: 321,
        }),
      }),
    );
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
    expect(result.revision).toBe('5');
  });

  it('throws not found for missing revision lookup', async () => {
    prisma.priceConfig.findFirst.mockResolvedValue(null);

    await expect(
      service.findSpecificRevision('design', BigInt(1), BigInt(1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
