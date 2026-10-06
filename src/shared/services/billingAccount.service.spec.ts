import { HttpService } from '@nestjs/axios';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { BillingAccountService } from './billingAccount.service';

jest.mock('src/shared/config/service-endpoints.config', () => ({
  SERVICE_ENDPOINTS: {
    billingAccountsApiUrl: 'https://billing-accounts.test/v6/billing-accounts/',
    identityApiUrl: 'https://identity.test',
    memberApiUrl: 'https://member.test',
  },
}));

describe('BillingAccountService', () => {
  const originalEnv = { ...process.env };

  const httpServiceMock = {
    get: jest.fn(),
    post: jest.fn(),
  };

  const m2mServiceMock = {
    getM2MToken: jest.fn().mockResolvedValue('m2m-token'),
  };

  let service: BillingAccountService;

  beforeEach(() => {
    jest.clearAllMocks();
    httpServiceMock.get.mockReset();
    httpServiceMock.post.mockReset();
    process.env = {
      ...originalEnv,
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns default billing account details from the Billing Accounts API when available', async () => {
    httpServiceMock.get.mockReturnValueOnce(
      of({
        data: {
          id: 80001063,
          markup: '0.33',
          name: 'Acme Billing Account',
          status: 'ACTIVE',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      }),
    );

    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );

    const result = await service.getDefaultBillingAccount('80001063');

    expect(m2mServiceMock.getM2MToken).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.get).toHaveBeenCalledWith(
      'https://billing-accounts.test/v6/billing-accounts/80001063',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer m2m-token',
        }),
        timeout: 5000,
      }),
    );
    expect(result).toEqual({
      tcBillingAccountId: '80001063',
      markup: 0.33,
      name: 'Acme Billing Account',
      active: true,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('deduplicates account ids and uses the API without Salesforce configuration', async () => {
    delete process.env.SALESFORCE_CLIENT_ID;
    httpServiceMock.get.mockImplementation((url: string) =>
      of({
        data: {
          id: Number(url.split('/').pop()),
          name: 'Account',
        },
      }),
    );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    const result = await service.getBillingAccountsByIds([
      '12',
      '12',
      '13',
      'bad',
    ]);
    expect(Object.keys(result)).toEqual(['12', '13']);
    expect(result['12']).toMatchObject({
      tcBillingAccountId: '12',
    });
    expect(httpServiceMock.get).toHaveBeenCalledTimes(2);
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('falls back only for missing accounts and retains API metadata', async () => {
    process.env.SALESFORCE_CLIENT_ID = 'client';
    process.env.SALESFORCE_CLIENT_AUDIENCE = 'https://login.salesforce.com';
    process.env.SALESFORCE_SUBJECT = 'user';
    process.env.SALESFORCE_CLIENT_KEY = 'key';
    httpServiceMock.get.mockImplementation((url: string) =>
      url.endsWith('/12')
        ? of({ data: { id: 12, name: 'Engineering' } })
        : throwError(() => new Error('missing')),
    );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    (service as any).authenticate = jest.fn().mockResolvedValue({
      accessToken: 'token',
      instanceUrl: 'https://salesforce.test',
    });
    (service as any).queryBillingAccountRecords = jest.fn().mockResolvedValue([
      {
        TopCoder_Billing_Account_Id__c: '13',
        Billing_Account_name__c: 'Legacy',
      },
    ]);
    const result = await service.getBillingAccountsByIds(['12', '13', '14']);
    expect(result['12'].name).toBe('Engineering');
    expect(result['13'].name).toBe('Legacy');
    expect(result['14']).toBeUndefined();
    expect((service as any).queryBillingAccountRecords).toHaveBeenCalledWith(
      expect.stringContaining("IN ('13','14')"),
      'token',
      'https://salesforce.test',
    );
  });

  it('omits unresolved accounts when both integrations are unavailable', async () => {
    delete process.env.SALESFORCE_CLIENT_ID;
    httpServiceMock.get.mockReturnValue(
      throwError(() => new Error('unavailable')),
    );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    expect(await service.getBillingAccountsByIds(['12'])).toEqual({});
  });

  it('skips external requests for empty or invalid ids', async () => {
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    expect(await service.getBillingAccountsByIds([])).toEqual({});
    expect(await service.getBillingAccountsByIds(['', '12bad'])).toEqual({});
    expect(httpServiceMock.get).not.toHaveBeenCalled();
    expect(m2mServiceMock.getM2MToken).not.toHaveBeenCalled();
  });

  it('falls back to Salesforce when the Billing Accounts API lookup fails', async () => {
    process.env.SALESFORCE_CLIENT_ID = 'salesforce-client-id';
    process.env.SALESFORCE_CLIENT_AUDIENCE = 'https://login.salesforce.com';
    process.env.SALESFORCE_SUBJECT = 'integration-user';
    process.env.SALESFORCE_CLIENT_KEY = 'private-key';

    httpServiceMock.get.mockReturnValueOnce(
      throwError(() => new Error('billing accounts api unavailable')),
    );

    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );

    (service as any).authenticate = jest.fn().mockResolvedValue({
      accessToken: 'salesforce-token',
      instanceUrl: 'https://salesforce.example.com',
    });
    (service as any).queryBillingAccountRecords = jest.fn().mockResolvedValue([
      {
        TopCoder_Billing_Account_Id__c: '80001063',
        Mark_Up__c: 0.42,
        Active__c: true,
        Start_Date__c: '2026-01-01',
        End_Date__c: '2026-12-31',
      },
    ]);

    const result = await service.getDefaultBillingAccount('80001063');

    expect(result).toEqual({
      tcBillingAccountId: '80001063',
      markup: 0.42,
      active: true,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect((service as any).authenticate).toHaveBeenCalledTimes(1);
    expect((service as any).queryBillingAccountRecords).toHaveBeenCalledTimes(
      1,
    );
    expect(httpServiceMock.get).toHaveBeenCalledTimes(1);
  });

  it('loads every opportunity account page and exposes only ID/name summaries', async () => {
    const opportunity = '006UN00000XamntYAB';
    httpServiceMock.get
      .mockReturnValueOnce(
        of({
          data: {
            totalPages: 2,
            data: [{ id: 22, name: ' Current ', opportunity, markup: '0.5' }],
          },
        }),
      )
      .mockReturnValueOnce(
        of({
          data: {
            totalPages: 2,
            data: [
              {
                id: 11,
                name: 'Previous',
                opportunity: opportunity.slice(0, 15),
                status: 'INACTIVE',
              },
            ],
          },
        }),
      );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    await expect(
      service.getBillingAccountsForOpportunity(opportunity),
    ).resolves.toEqual([
      { id: '22', name: 'Current' },
      { id: '11', name: 'Previous' },
    ]);
    expect(m2mServiceMock.getM2MToken).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.get).toHaveBeenNthCalledWith(
      2,
      'https://billing-accounts.test/v6/billing-accounts',
      expect.objectContaining({
        params: {
          opportunity,
          page: 2,
          perPage: 100,
          sortBy: 'id',
          sortOrder: 'desc',
        },
        headers: { Authorization: 'Bearer m2m-token' },
        timeout: 5000,
      }),
    );
  });

  it('returns no accounts for an empty filtered listing', async () => {
    httpServiceMock.get.mockReturnValueOnce(
      of({ data: { totalPages: 0, data: [] } }),
    );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    await expect(
      service.getBillingAccountsForOpportunity('006UN00000XamntYAB'),
    ).resolves.toEqual([]);
    expect(httpServiceMock.get).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid opportunity before calling upstream', async () => {
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    await expect(
      service.getBillingAccountsForOpportunity('bad'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(httpServiceMock.get).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { data: [], totalPages: '2' },
    { data: [{ id: 22, opportunity: '006000000000001AAA' }], totalPages: 1 },
    {
      data: [{ id: 'invalid', opportunity: '006UN00000XamntYAB' }],
      totalPages: 1,
    },
  ])(
    'rejects invalid or unfiltered responses instead of linking an unrelated project',
    async (data) => {
      httpServiceMock.get.mockReturnValueOnce(of({ data }));
      service = new BillingAccountService(
        httpServiceMock as unknown as HttpService,
        m2mServiceMock as unknown as M2MService,
      );
      await expect(
        service.getBillingAccountsForOpportunity('006UN00000XamntYAB'),
      ).rejects.toBeInstanceOf(BadGatewayException);
    },
  );

  it('sanitizes failures without treating them as a missing account', async () => {
    httpServiceMock.get.mockReturnValueOnce(
      throwError(() => new Error('private transport details')),
    );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    await expect(
      service.getBillingAccountsForOpportunity('006UN00000XamntYAB'),
    ).rejects.toThrow('Unable to load opportunity billing accounts.');
  });
});
