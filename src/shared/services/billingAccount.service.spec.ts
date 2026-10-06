import { HttpService } from '@nestjs/axios';
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
      id: 80001063,
      status: 'ACTIVE',
      tcBillingAccountId: '80001063',
      markup: 0.33,
      name: 'Acme Billing Account',
      active: true,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('preserves table metadata and the full client without exposing ledger rows or totals', async () => {
    const client = {
      id: 'client-1',
      name: 'Acme',
      codeName: 'ACME',
      status: 'ACTIVE',
      salesforceAccountId: '001',
      accountStatus: 'Customer',
      billingStreet: '1 Main Street',
      billingCity: 'Boston',
      billingState: 'MA',
      billingPostalCode: '02101',
      billingCountry: 'US',
      phone: '123',
      website: 'https://acme.test',
      industry: 'Technology',
      parentId: null,
      paymentTerms: 'Net 30',
      startDate: null,
      endDate: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-02-01',
    };
    const metadata = {
      id: 12,
      salesforceBillingAccountId: 'a01',
      billingAccountType: 'Customer',
      billingNotes: 'Notes',
      billingFrequency: 'Monthly',
      opportunity: '006',
      subscription: 'sub',
      spoc: 'person-1',
      secondarySpoc: null,
      costCenter: 'Engineering',
      workdayContractNumber: 'WD-123',
      poNumber: 'PO-123',
      subscriptionNumber: 'SUB-123',
      paymentTerms: 'Net 30',
      clientId: client.id,
      budget: '1000.0000',
      salesTax: null,
    };
    httpServiceMock.get.mockReturnValue(
      of({
        data: {
          ...metadata,
          client,
          markup: '0.2',
          status: 'INACTIVE',
          lockedAmounts: [{ id: 'private-ledger-row' }],
          consumedAmounts: [],
          remaining: 900,
          locked: 100,
          consumed: 0,
        },
      }),
    );
    service = new BillingAccountService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
    const result = await service.getDefaultBillingAccount('12');
    expect(result).toMatchObject({
      ...metadata,
      client,
      tcBillingAccountId: '12',
      markup: 0.2,
      active: false,
    });
    for (const field of [
      'lockedAmounts',
      'consumedAmounts',
      'remaining',
      'locked',
      'consumed',
    ]) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('deduplicates account ids and uses the API without Salesforce configuration', async () => {
    delete process.env.SALESFORCE_CLIENT_ID;
    httpServiceMock.get.mockImplementation((url: string) =>
      of({
        data: {
          id: Number(url.split('/').pop()),
          name: 'Account',
          client: null,
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
      client: null,
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
        ? of({ data: { id: 12, costCenter: 'Engineering' } })
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
    expect(result['12'].costCenter).toBe('Engineering');
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
});
