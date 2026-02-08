import { NotFoundException } from '@nestjs/common';
import { WorkStreamStatus } from '@prisma/client';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { WorkStreamService } from './workstream.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishWorkstreamEvent: jest.fn(() => Promise.resolve()),
  publishNotificationEvent: jest.fn(() => Promise.resolve()),
}));

const eventUtils = jest.requireMock('src/shared/utils/event.utils');

function buildWorkStreamRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(11),
    projectId: BigInt(1001),
    name: 'Default Stream',
    type: 'development',
    status: WorkStreamStatus.active,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    ...overrides,
  };
}

describe('WorkStreamService', () => {
  const prisma = {
    project: {
      findFirst: jest.fn(),
    },
    workStream: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    phaseWorkStream: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  let service: WorkStreamService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkStreamService(prisma as never);
    prisma.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
    });
  });

  it('creates a work stream when project exists', async () => {
    prisma.workStream.create.mockResolvedValue(
      buildWorkStreamRecord({
        name: 'Delivery',
      }),
    );

    const result = await service.create(
      '1001',
      {
        name: 'Delivery',
        type: 'app',
        status: WorkStreamStatus.active,
      },
      '123',
    );

    expect(result.name).toBe('Delivery');
    expect(result.id).toBe('11');
    expect(prisma.workStream.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: BigInt(1001),
          createdBy: BigInt(123),
          updatedBy: BigInt(123),
        }),
      }),
    );
    expect(eventUtils.publishWorkstreamEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_WORKSTREAM_ADDED,
      expect.any(Object),
    );
  });

  it('throws not found when loading missing work stream', async () => {
    prisma.workStream.findFirst.mockResolvedValue(null);

    await expect(service.findOne('1001', '9999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists by status with pagination', async () => {
    prisma.workStream.findMany.mockResolvedValue([
      buildWorkStreamRecord({
        id: BigInt(1),
      }),
      buildWorkStreamRecord({
        id: BigInt(2),
      }),
    ]);

    const result = await service.findAll('1001', {
      status: WorkStreamStatus.active,
      page: 2,
      perPage: 5,
    });

    expect(result).toHaveLength(2);
    expect(prisma.workStream.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
        where: expect.objectContaining({
          status: WorkStreamStatus.active,
        }),
      }),
    );
  });

  it('throws not found when deleting a missing work stream', async () => {
    prisma.workStream.findFirst.mockResolvedValue(null);

    await expect(service.delete('1001', '99', '123')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
