import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductTemplateService } from './product-template.service';

function buildProductTemplateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(1),
    name: 'Template',
    productKey: 'challenge',
    category: 'development',
    subCategory: 'coding',
    icon: 'icon',
    brief: 'brief',
    details: 'details',
    aliases: ['alias'],
    template: { data: true },
    form: null,
    disabled: false,
    hidden: false,
    isAddOn: false,
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedBy: null,
    createdBy: BigInt(123),
    updatedBy: BigInt(123),
    ...overrides,
  };
}

describe('ProductTemplateService', () => {
  const prisma = {
    productTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    form: {
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

  let service: ProductTemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductTemplateService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
      formService as never,
    );
  });

  it('creates product template and publishes event', async () => {
    prisma.productTemplate.create.mockResolvedValue(
      buildProductTemplateRecord(),
    );

    const result = await service.create(
      {
        name: 'Template',
        productKey: 'challenge',
        category: 'development',
        subCategory: 'coding',
        icon: 'icon',
        brief: 'brief',
        details: 'details',
        aliases: ['alias'],
      },
      BigInt(123),
    );

    expect(result.id).toBe('1');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('upgrades template by creating new form version', async () => {
    prisma.productTemplate.findFirst.mockResolvedValueOnce(
      buildProductTemplateRecord(),
    );

    formService.createVersion.mockResolvedValue({ version: '2' });

    prisma.productTemplate.update.mockResolvedValue(
      buildProductTemplateRecord({
        template: null,
        form: { key: 'challenge', version: 2 },
      }),
    );

    prisma.form.findFirst.mockResolvedValue({
      id: BigInt(5),
      key: 'challenge',
      version: BigInt(2),
      revision: BigInt(1),
      config: {},
    });

    const result = await service.upgrade(BigInt(1), {}, BigInt(123));

    expect(formService.createVersion).toHaveBeenCalled();
    expect(result.form).toEqual(
      expect.objectContaining({
        key: 'challenge',
        version: '2',
      }),
    );
  });

  it('reuses existing form reference when upgrade dto omits form', async () => {
    prisma.productTemplate.findFirst.mockResolvedValueOnce(
      buildProductTemplateRecord({
        template: null,
        form: { key: 'challenge', version: 2 },
      }),
    );

    prisma.productTemplate.update.mockResolvedValue(
      buildProductTemplateRecord({
        template: null,
        form: { key: 'challenge', version: 2 },
      }),
    );

    prisma.form.findFirst.mockResolvedValue({
      id: BigInt(5),
      key: 'challenge',
      version: BigInt(2),
      revision: BigInt(1),
      config: {},
    });

    const result = await service.upgrade(BigInt(1), {}, BigInt(123));

    expect(formService.createVersion).not.toHaveBeenCalled();
    expect(prisma.productTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          form: { key: 'challenge', version: 2 },
        }),
      }),
    );
    expect(result.form).toEqual(
      expect.objectContaining({
        key: 'challenge',
        version: '2',
      }),
    );
  });

  it('throws bad request when no form reference and no legacy template exists', async () => {
    prisma.productTemplate.findFirst.mockResolvedValueOnce(
      buildProductTemplateRecord({
        template: null,
        form: null,
      }),
    );

    await expect(service.upgrade(BigInt(1), {}, BigInt(123))).rejects.toThrow(
      new BadRequestException(
        'Cannot upgrade product template: form reference is missing and legacy template is unavailable.',
      ),
    );
  });

  it('throws not found for unknown product template', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue(null);

    await expect(service.findOne(BigInt(999))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
