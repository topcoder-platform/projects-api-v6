import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectTemplateService } from './project-template.service';

function buildProjectTemplateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    name: 'Template',
    key: 'design',
    category: 'development',
    subCategory: 'web',
    metadata: {},
    icon: 'icon',
    question: 'question',
    info: 'info',
    aliases: ['alias'],
    scope: { sections: [] },
    phases: { phase: true },
    form: null,
    planConfig: null,
    priceConfig: null,
    disabled: false,
    hidden: false,
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    ...overrides,
  };
}

describe('ProjectTemplateService', () => {
  const prisma = {
    projectTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    form: {
      findFirst: jest.fn(),
    },
    planConfig: {
      findFirst: jest.fn(),
    },
    priceConfig: {
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

  const formService = {
    createVersion: jest.fn(),
  };

  const planConfigService = {
    createVersion: jest.fn(),
  };

  const priceConfigService = {
    createVersion: jest.fn(),
  };

  let service: ProjectTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectTemplateService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
      formService as never,
      planConfigService as never,
      priceConfigService as never,
    );
  });

  it('creates project template and publishes event', async () => {
    prisma.projectTemplate.create.mockResolvedValue(
      buildProjectTemplateRecord(),
    );

    const result = await service.create(
      {
        name: 'Template',
        key: 'design',
        category: 'development',
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['alias'],
      },
      BigInt(123),
    );

    expect(result.id).toBe('1');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('upgrades template by creating new versioned configs', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValueOnce(
      buildProjectTemplateRecord({
        scope: { sections: [], wizard: [] },
        phases: { phase: true },
      }),
    );

    formService.createVersion.mockResolvedValue({ version: '2' });
    planConfigService.createVersion.mockResolvedValue({ version: '3' });
    priceConfigService.createVersion.mockResolvedValue({ version: '4' });

    prisma.projectTemplate.update.mockResolvedValue(
      buildProjectTemplateRecord({
        scope: null,
        phases: null,
        form: { key: 'design', version: 2 },
        planConfig: { key: 'design', version: 3 },
        priceConfig: { key: 'design', version: 4 },
      }),
    );

    prisma.form.findFirst.mockResolvedValue({
      id: BigInt(5),
      key: 'design',
      version: BigInt(2),
      revision: BigInt(1),
      config: {},
    });
    prisma.planConfig.findFirst.mockResolvedValue({
      id: BigInt(6),
      key: 'design',
      version: BigInt(3),
      revision: BigInt(1),
      config: {},
    });
    prisma.priceConfig.findFirst.mockResolvedValue({
      id: BigInt(7),
      key: 'design',
      version: BigInt(4),
      revision: BigInt(1),
      config: {},
    });

    const result = await service.upgrade(BigInt(1), {}, BigInt(123));

    expect(formService.createVersion).toHaveBeenCalled();
    expect(planConfigService.createVersion).toHaveBeenCalled();
    expect(priceConfigService.createVersion).toHaveBeenCalled();
    expect(result.form).toEqual(
      expect.objectContaining({
        key: 'design',
        version: '2',
      }),
    );
  });

  it('reuses existing references when upgrade dto omits references', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValueOnce(
      buildProjectTemplateRecord({
        scope: null,
        phases: null,
        form: { key: 'design', version: 2 },
        planConfig: { key: 'design', version: 3 },
        priceConfig: { key: 'design', version: 4 },
      }),
    );

    prisma.projectTemplate.update.mockResolvedValue(
      buildProjectTemplateRecord({
        scope: null,
        phases: null,
        form: { key: 'design', version: 2 },
        planConfig: { key: 'design', version: 3 },
        priceConfig: { key: 'design', version: 4 },
      }),
    );

    prisma.form.findFirst.mockResolvedValue({
      id: BigInt(5),
      key: 'design',
      version: BigInt(2),
      revision: BigInt(1),
      config: {},
    });
    prisma.planConfig.findFirst.mockResolvedValue({
      id: BigInt(6),
      key: 'design',
      version: BigInt(3),
      revision: BigInt(1),
      config: {},
    });
    prisma.priceConfig.findFirst.mockResolvedValue({
      id: BigInt(7),
      key: 'design',
      version: BigInt(4),
      revision: BigInt(1),
      config: {},
    });

    const result = await service.upgrade(BigInt(1), {}, BigInt(123));

    expect(formService.createVersion).not.toHaveBeenCalled();
    expect(planConfigService.createVersion).not.toHaveBeenCalled();
    expect(priceConfigService.createVersion).not.toHaveBeenCalled();
    expect(prisma.projectTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          form: { key: 'design', version: 2 },
          planConfig: { key: 'design', version: 3 },
          priceConfig: { key: 'design', version: 4 },
        }),
      }),
    );
    expect(result.form).toEqual(
      expect.objectContaining({
        key: 'design',
        version: '2',
      }),
    );
  });

  it('throws bad request when no references and no legacy values are available', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValueOnce(
      buildProjectTemplateRecord({
        scope: null,
        phases: null,
        form: null,
        planConfig: null,
        priceConfig: null,
      }),
    );

    await expect(service.upgrade(BigInt(1), {}, BigInt(123))).rejects.toThrow(
      new BadRequestException(
        'Cannot upgrade project template: form reference is missing and legacy scope is unavailable.',
      ),
    );
  });

  it('throws not found for unknown template', async () => {
    prisma.projectTemplate.findFirst.mockResolvedValue(null);

    await expect(service.findOne(BigInt(999))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
