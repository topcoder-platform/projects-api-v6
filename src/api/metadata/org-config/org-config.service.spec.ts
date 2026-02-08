import { ConflictException } from '@nestjs/common';
import { OrgConfigService } from './org-config.service';

function buildOrgConfigRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    orgId: '1001',
    configName: 'defaultRegion',
    configValue: 'US',
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    ...overrides,
  };
}

describe('OrgConfigService', () => {
  const prisma = {
    orgConfig: {
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

  let service: OrgConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrgConfigService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates org config and publishes event', async () => {
    prisma.orgConfig.findFirst.mockResolvedValueOnce(null);
    prisma.orgConfig.create.mockResolvedValue(buildOrgConfigRecord());

    const result = await service.create(
      {
        orgId: '1001',
        configName: 'defaultRegion',
        configValue: 'US',
      },
      BigInt(123),
    );

    expect(result.id).toBe('1');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('throws conflict for duplicate org config', async () => {
    prisma.orgConfig.findFirst.mockResolvedValue(buildOrgConfigRecord());

    await expect(
      service.create(
        {
          orgId: '1001',
          configName: 'defaultRegion',
          configValue: 'US',
        },
        BigInt(123),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
