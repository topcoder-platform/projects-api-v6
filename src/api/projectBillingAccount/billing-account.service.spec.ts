import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingAccountService } from './billing-account.service';
import { BillingAccountService as BillingAccountLookupService } from '../../shared/services/billingAccount.service';

jest.mock('../../shared/services/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../shared/services/billingAccount.service', () => ({
  BillingAccountService: class BillingAccountLookupService {},
}));

describe('Project BillingAccountService', () => {
  let prismaMock: {
    project: {
      findUnique: jest.Mock;
    };
  };
  let billingAccountLookupServiceMock: {
    getBillingAccountsForProject: jest.Mock;
    getDefaultBillingAccount: jest.Mock;
  };
  let service: BillingAccountService;

  beforeEach(() => {
    prismaMock = {
      project: {
        findUnique: jest.fn(),
      },
    };
    billingAccountLookupServiceMock = {
      getBillingAccountsForProject: jest.fn(),
      getDefaultBillingAccount: jest.fn(),
    };
    service = new BillingAccountService(
      prismaMock as any,
      billingAccountLookupServiceMock as unknown as BillingAccountLookupService,
    );
  });

  it('returns billing-account details using the project default billing account id', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      billingAccountId: BigInt(80001063),
    });
    billingAccountLookupServiceMock.getDefaultBillingAccount.mockResolvedValueOnce(
      {
        active: true,
        endDate: '2026-10-16T23:59:00.000Z',
        markup: 0.33,
        name: 'BA For Marios',
        startDate: '2023-10-31T00:00:00.000Z',
        tcBillingAccountId: '80001063',
      },
    );

    const result = await service.getAccount('100575');

    expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
      select: {
        billingAccountId: true,
      },
      where: {
        id: BigInt(100575),
      },
    });
    expect(
      billingAccountLookupServiceMock.getDefaultBillingAccount,
    ).toHaveBeenCalledWith('80001063');
    expect(result).toEqual({
      active: true,
      endDate: '2026-10-16T23:59:00.000Z',
      markup: 0.33,
      startDate: '2023-10-31T00:00:00.000Z',
      tcBillingAccountId: '80001063',
    });
  });

  it('keeps the project billing account id when upstream details are unavailable', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      billingAccountId: BigInt(80001063),
    });
    billingAccountLookupServiceMock.getDefaultBillingAccount.mockResolvedValueOnce(
      null,
    );

    await expect(service.getAccount('100575')).resolves.toEqual({
      active: null,
      endDate: null,
      markup: null,
      startDate: null,
      tcBillingAccountId: '80001063',
    });
  });

  it('returns null fields when the project has no default billing account', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      billingAccountId: null,
    });

    await expect(service.getAccount('100575')).resolves.toEqual({
      active: null,
      endDate: null,
      markup: null,
      startDate: null,
      tcBillingAccountId: null,
    });
    expect(
      billingAccountLookupServiceMock.getDefaultBillingAccount,
    ).not.toHaveBeenCalled();
  });

  it('throws when the project does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);

    await expect(service.getAccount('100575')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when project id is not a positive integer', async () => {
    await expect(service.getAccount('bad-id')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.project.findUnique).not.toHaveBeenCalled();
  });

  it('lists billing accounts for the authenticated user when the project exists', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce({
      billingAccountId: BigInt(80001063),
    });
    billingAccountLookupServiceMock.getBillingAccountsForProject.mockResolvedValueOnce(
      [
        {
          endDate: '2026-10-16',
          name: 'BA For Marios',
          sfBillingAccountId: '001xx000003DGbY',
          startDate: '2023-10-31',
          tcBillingAccountId: '80001063',
        },
      ],
    );

    await expect(service.listAccounts('100575', '305384')).resolves.toEqual([
      {
        endDate: '2026-10-16',
        name: 'BA For Marios',
        sfBillingAccountId: '001xx000003DGbY',
        startDate: '2023-10-31',
        tcBillingAccountId: '80001063',
      },
    ]);
    expect(
      billingAccountLookupServiceMock.getBillingAccountsForProject,
    ).toHaveBeenCalledWith('100575', '305384');
  });
});
