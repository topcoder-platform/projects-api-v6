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
