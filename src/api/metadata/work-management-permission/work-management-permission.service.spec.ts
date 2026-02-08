import { ConflictException, NotFoundException } from '@nestjs/common';
import { WorkManagementPermissionService } from './work-management-permission.service';

function buildWorkManagementPermissionRecord(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: BigInt(1),
    policy: 'default',
    permission: { read: true },
    projectTemplateId: BigInt(1001),
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: 123,
    updatedBy: 123,
    ...overrides,
  };
}

describe('WorkManagementPermissionService', () => {
  const prisma = {
    workManagementPermission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    projectTemplate: {
      findFirst: jest.fn(),
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

  let service: WorkManagementPermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkManagementPermissionService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('lists permissions filtered by projectTemplateId', async () => {
    prisma.workManagementPermission.findMany.mockResolvedValue([
      buildWorkManagementPermissionRecord(),
    ]);

    const result = await service.findAll({
      projectTemplateId: 1001,
    });

    expect(result).toHaveLength(1);
    expect(prisma.workManagementPermission.findMany).toHaveBeenCalledWith({
      where: {
        projectTemplateId: BigInt(1001),
        deletedAt: null,
      },
      orderBy: [{ id: 'asc' }],
    });
  });

  it('creates work management permission and publishes event', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: BigInt(1001) });
    prisma.workManagementPermission.findFirst.mockResolvedValue(null);
    prisma.workManagementPermission.create.mockResolvedValue(
      buildWorkManagementPermissionRecord(),
    );

    const result = await service.create(
      {
        policy: 'default',
        permission: { read: true },
        projectTemplateId: 1001,
      },
      123,
    );

    expect(result.id).toBe('1');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('throws conflict on duplicated policy and project template', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue({ id: BigInt(1001) });
    prisma.workManagementPermission.findFirst.mockResolvedValue(
      buildWorkManagementPermissionRecord(),
    );

    await expect(
      service.create(
        {
          policy: 'default',
          permission: { read: true },
          projectTemplateId: 1001,
        },
        123,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws not found when project template is missing', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          policy: 'default',
          permission: { read: true },
          projectTemplateId: 2002,
        },
        123,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
