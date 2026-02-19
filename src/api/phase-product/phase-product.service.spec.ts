import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Permission } from 'src/shared/constants/permissions';
import { PermissionService } from 'src/shared/services/permission.service';
import { PhaseProductService } from './phase-product.service';

describe('PhaseProductService', () => {
  const prismaMock = {
    project: {
      findFirst: jest.fn(),
    },
    projectPhase: {
      findFirst: jest.fn(),
    },
    phaseProduct: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  let service: PhaseProductService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new PhaseProductService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
    );

    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      directProjectId: BigInt(2001),
      billingAccountId: BigInt(3001),
      members: [
        {
          userId: BigInt(100),
          role: 'manager',
          deletedAt: null,
        },
      ],
    });

    prismaMock.projectPhase.findFirst.mockResolvedValue({
      id: BigInt(10),
    });
  });

  it('creates phase product with inherited project fields', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.ADD_PHASE_PRODUCT) {
          return true;
        }

        return false;
      },
    );

    prismaMock.phaseProduct.count.mockResolvedValue(0);
    prismaMock.phaseProduct.create.mockResolvedValue({
      id: BigInt(91),
      phaseId: BigInt(10),
      projectId: BigInt(1001),
      directProjectId: BigInt(2001),
      billingAccountId: BigInt(3001),
      templateId: BigInt(67),
      name: 'Generic Product',
      type: 'generic-product',
      estimatedPrice: 1,
      actualPrice: 1,
      details: { challengeGuid: 'abc' },
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 100,
      updatedBy: 100,
    });

    const response = await service.createPhaseProduct(
      '1001',
      '10',
      {
        name: 'Generic Product',
        type: 'generic-product',
        templateId: 67,
        estimatedPrice: 1,
        actualPrice: 1,
        details: { challengeGuid: 'abc' },
      },
      {
        userId: '100',
        isMachine: false,
      },
    );

    expect(response.id).toBe('91');
    expect(prismaMock.phaseProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          directProjectId: BigInt(2001),
          billingAccountId: BigInt(3001),
        }),
      }),
    );
  });

  it('enforces max products per phase', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.ADD_PHASE_PRODUCT) {
          return true;
        }

        return false;
      },
    );

    prismaMock.phaseProduct.count.mockResolvedValue(20);

    await expect(
      service.createPhaseProduct(
        '1001',
        '10',
        {
          name: 'Generic Product',
          type: 'generic-product',
        },
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft deletes phase product', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.DELETE_PHASE_PRODUCT) {
          return true;
        }

        return false;
      },
    );

    prismaMock.phaseProduct.findFirst.mockResolvedValue({
      id: BigInt(91),
      phaseId: BigInt(10),
      projectId: BigInt(1001),
      directProjectId: BigInt(2001),
      billingAccountId: BigInt(3001),
      templateId: BigInt(67),
      name: 'Generic Product',
      type: 'generic-product',
      estimatedPrice: 1,
      actualPrice: 1,
      details: {},
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 100,
      updatedBy: 100,
    });

    prismaMock.phaseProduct.update.mockResolvedValue({
      id: BigInt(91),
      phaseId: BigInt(10),
      projectId: BigInt(1001),
    });

    await service.deletePhaseProduct('1001', '10', '91', {
      userId: '100',
      isMachine: false,
    });

    expect(prismaMock.phaseProduct.update).toHaveBeenCalled();
  });

  it('throws forbidden when create permission is missing', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(false);

    await expect(
      service.createPhaseProduct(
        '1001',
        '10',
        {
          name: 'Generic Product',
          type: 'generic-product',
        },
        {
          userId: '100',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
