import { ConflictException } from '@nestjs/common';
import { ProjectTypeService } from './project-type.service';

function buildProjectTypeRecord(overrides: Record<string, unknown> = {}) {
  return {
    key: 'design',
    displayName: 'Design',
    icon: 'icon',
    question: 'question',
    info: 'info',
    aliases: ['d'],
    metadata: { a: true },
    disabled: false,
    hidden: false,
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: 123,
    updatedBy: 123,
    ...overrides,
  };
}

describe('ProjectTypeService', () => {
  const prisma = {
    projectType: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
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

  let service: ProjectTypeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectTypeService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates project type and publishes event', async () => {
    prisma.projectType.findUnique.mockResolvedValue(null);
    prisma.projectType.create.mockResolvedValue(buildProjectTypeRecord());

    const result = await service.create(
      {
        key: 'design',
        displayName: 'Design',
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['d'],
        metadata: { a: true },
      },
      123,
    );

    expect(result.key).toBe('design');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('throws conflict when key already exists', async () => {
    prisma.projectType.findUnique.mockResolvedValue(buildProjectTypeRecord());

    await expect(
      service.create(
        {
          key: 'design',
          displayName: 'Design',
          icon: 'icon',
          question: 'question',
          info: 'info',
          aliases: ['d'],
          metadata: { a: true },
        },
        123,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
