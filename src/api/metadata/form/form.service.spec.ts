import { NotFoundException } from '@nestjs/common';
import { FormService } from './form.service';

function buildFormRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    key: 'design',
    version: BigInt(1),
    revision: BigInt(1),
    config: { sections: [] },
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: 123,
    updatedBy: 123,
    ...overrides,
  };
}

describe('FormService', () => {
  const prisma = {
    form: {
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

  let service: FormService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FormService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates a new form version with auto-incremented version', async () => {
    prisma.form.findFirst.mockResolvedValue({ version: BigInt(2) });
    prisma.form.create.mockResolvedValue(
      buildFormRecord({
        id: BigInt(10),
        version: BigInt(3),
      }),
    );

    const result = await service.createVersion('design', { config: true }, 321);

    expect(prisma.form.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'design',
          version: BigInt(3),
          revision: BigInt(1),
          createdBy: 321,
          updatedBy: 321,
        }),
      }),
    );
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
    expect(result.version).toBe('3');
  });

  it('throws not found for missing revision lookup', async () => {
    prisma.form.findFirst.mockResolvedValue(null);

    await expect(
      service.findSpecificRevision('design', BigInt(1), BigInt(1)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
