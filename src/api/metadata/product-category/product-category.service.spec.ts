import { ConflictException } from '@nestjs/common';
import { ProductCategoryService } from './product-category.service';

function buildProductCategoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    key: 'development',
    displayName: 'Development',
    icon: 'icon',
    question: 'question',
    info: 'info',
    aliases: ['dev'],
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

describe('ProductCategoryService', () => {
  const prisma = {
    productCategory: {
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

  let service: ProductCategoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductCategoryService(
      prisma as never,
      prismaErrorService as never,
      eventBusService as never,
    );
  });

  it('creates product category and publishes event', async () => {
    prisma.productCategory.findUnique.mockResolvedValue(null);
    prisma.productCategory.create.mockResolvedValue(
      buildProductCategoryRecord(),
    );

    const result = await service.create(
      {
        key: 'development',
        displayName: 'Development',
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['dev'],
      },
      123,
    );

    expect(result.key).toBe('development');
    expect(eventBusService.publishProjectEvent).toHaveBeenCalled();
  });

  it('throws conflict when key already exists', async () => {
    prisma.productCategory.findUnique.mockResolvedValue(
      buildProductCategoryRecord(),
    );

    await expect(
      service.create(
        {
          key: 'development',
          displayName: 'Development',
          icon: 'icon',
          question: 'question',
          info: 'info',
          aliases: ['dev'],
        },
        123,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
