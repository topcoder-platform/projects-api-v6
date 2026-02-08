import { MetadataListService } from './metadata-list.service';

describe('MetadataListService', () => {
  const prisma = {
    projectTemplate: {
      findMany: jest.fn(),
    },
    productTemplate: {
      findMany: jest.fn(),
    },
    projectType: {
      findMany: jest.fn(),
    },
    productCategory: {
      findMany: jest.fn(),
    },
    milestoneTemplate: {
      findMany: jest.fn(),
    },
    form: {
      findMany: jest.fn(),
    },
    planConfig: {
      findMany: jest.fn(),
    },
    priceConfig: {
      findMany: jest.fn(),
    },
  };

  let service: MetadataListService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataListService(prisma as never);

    prisma.projectTemplate.findMany.mockResolvedValue([
      {
        id: BigInt(1),
        form: { key: 'form_key', version: 1 },
        planConfig: { key: 'plan_key', version: 1 },
        priceConfig: { key: 'price_key', version: 1 },
        disabled: false,
      },
    ]);

    prisma.productTemplate.findMany.mockResolvedValue([
      {
        id: BigInt(2),
        form: { key: 'form_key', version: 2 },
        disabled: false,
      },
    ]);

    prisma.projectType.findMany.mockResolvedValue([]);
    prisma.productCategory.findMany.mockResolvedValue([]);
    prisma.milestoneTemplate.findMany.mockResolvedValue([]);

    prisma.form.findMany.mockResolvedValue([
      {
        id: BigInt(10),
        key: 'form_key',
        version: BigInt(2),
        revision: BigInt(3),
      },
      {
        id: BigInt(11),
        key: 'form_key',
        version: BigInt(1),
        revision: BigInt(5),
      },
    ]);

    prisma.planConfig.findMany.mockResolvedValue([
      {
        id: BigInt(20),
        key: 'plan_key',
        version: BigInt(1),
        revision: BigInt(1),
      },
    ]);

    prisma.priceConfig.findMany.mockResolvedValue([
      {
        id: BigInt(30),
        key: 'price_key',
        version: BigInt(1),
        revision: BigInt(1),
      },
    ]);
  });

  it('returns latest versions when includeAllReferred is false', async () => {
    const result = await service.getAllMetadata(false);

    expect(result.forms).toHaveLength(1);
    expect(result.forms[0]).toEqual(
      expect.objectContaining({
        version: '2',
      }),
    );
  });

  it('returns latest + used versions when includeAllReferred is true', async () => {
    const result = await service.getAllMetadata(true);

    expect(result.forms).toHaveLength(2);
    expect(result.forms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: '1' }),
        expect.objectContaining({ version: '2' }),
      ]),
    );
  });
});
