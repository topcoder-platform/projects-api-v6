import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SalesforceOpportunityService } from './salesforce-opportunity.service';
import { SalesforceClient } from './salesforce.client';

import { getChallengesPrismaClient } from 'src/shared/global/external-prisma.client';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { BillingAccountService } from 'src/shared/services/billingAccount.service';

jest.mock('src/shared/global/external-prisma.client', () => ({
  getChallengesPrismaClient: jest.fn(),
}));

describe('SalesforceOpportunityService', () => {
  const findProject = jest.fn();
  const findChallenges = jest.fn();
  const findAccounts = jest.fn();
  const accountMetadata = jest.fn();
  beforeEach(() => {
    findProject.mockReset().mockResolvedValue(null);
    findChallenges.mockReset().mockResolvedValue([]);
    findAccounts.mockReset().mockResolvedValue([]);
    accountMetadata.mockReset().mockResolvedValue({});
    (getChallengesPrismaClient as jest.Mock).mockReturnValue({
      challenge: { findMany: findChallenges },
    });
  });
  const record = {
    Id: '006UN00000XamntYAB',
    Name: 'EMEA - Amazon Web Services - PS BFSI',
    Description: ' Pipeline for the BFSI practice ',
    CloseDate: '2026-07-31',
    StageName: 'Qualification',
    Reporting_SMU__c: 'AMR1',
    Subcontracting_End_Customer__r: { Name: 'Novartis Pharmaceuticals' },
  };

  /**
   * Builds the opportunity service with isolated upstream dependencies.
   * @param records Salesforce records; defaults to a complete opportunity.
   * @returns Service and SOQL mock for mapping and billing assertions.
   * @throws Does not throw.
   */
  function build(records: unknown[] = [record]): {
    service: SalesforceOpportunityService;
    query: jest.Mock;
  } {
    const query = jest.fn().mockResolvedValue(records);
    const client = {
      query,
      instanceOrigin: () => 'https://topcoder.my.salesforce.com',
    } as unknown as SalesforceClient;
    return {
      service: new SalesforceOpportunityService(
        client,
        { project: { findFirst: findProject } } as unknown as PrismaService,
        {
          getBillingAccountsForOpportunity: findAccounts,
          getBillingAccountsByIds: accountMetadata,
        } as unknown as BillingAccountService,
      ),
      query,
    };
  }

  it('maps the opportunity onto project detail fields', async () => {
    const { service, query } = build();

    await expect(
      service.getOpportunity(' 006UN00000XamntYAB '),
    ).resolves.toEqual({
      id: '006UN00000XamntYAB',
      name: 'EMEA - Amazon Web Services - PS BFSI',
      description: 'Pipeline for the BFSI practice',
      customer: 'Novartis Pharmaceuticals',
      smu: 'AMR1',
      reportingSmu: 'AMR1',
      closeDate: '2026-07-31',
      stageName: 'Qualification',
      url: 'https://topcoder.my.salesforce.com/006UN00000XamntYAB',
      billingAccount: null,
      projectId: null,
      relatedBillingAccounts: [],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE Id = '006UN00000XamntYAB'"),
    );
  });

  it('upgrades a legacy Reporting SMU to the supported option', async () => {
    const { service } = build([{ ...record, Reporting_SMU__c: 'Americas2' }]);

    await expect(
      service.getOpportunity('006UN00000XamntYAB'),
    ).resolves.toMatchObject({ smu: 'AMR2', reportingSmu: 'Americas2' });
  });

  it('surfaces an unrecognized Reporting SMU as a custom value', async () => {
    const { service } = build([{ ...record, Reporting_SMU__c: 'INTERNAL' }]);

    await expect(
      service.getOpportunity('006UN00000XamntYAB'),
    ).resolves.toMatchObject({ smu: 'Others', smuOther: 'INTERNAL' });
  });

  it('omits fields Salesforce left empty', async () => {
    const { service } = build([
      { Id: '006UN00000XamntYAB', Name: 'Unnamed', Description: '   ' },
    ]);

    await expect(service.getOpportunity('006UN00000XamntYAB')).resolves.toEqual(
      {
        id: '006UN00000XamntYAB',
        name: 'Unnamed',
        description: undefined,
        customer: undefined,
        reportingSmu: undefined,
        closeDate: undefined,
        stageName: undefined,
        url: 'https://topcoder.my.salesforce.com/006UN00000XamntYAB',
        billingAccount: null,
        projectId: null,
        relatedBillingAccounts: [],
      },
    );
  });

  it('accepts a 15 character id', async () => {
    const { service, query } = build([{ ...record, Id: '006UN00000Xamnt' }]);

    await expect(
      service.getOpportunity('006UN00000Xamnt'),
    ).resolves.toMatchObject({ id: '006UN00000Xamnt' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it.each([
    '',
    '006UN00000Xamn',
    '001UN00000XamntYAB',
    "006UN00000Xamnt' OR Id != '",
  ])('rejects the malformed id %j without querying', async (id) => {
    const { service, query } = build();

    await expect(service.getOpportunity(id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('reports an unknown opportunity as not found', async () => {
    const { service } = build([]);

    await expect(
      service.getOpportunity('006UN00000XamntYAB'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('skips project and challenge lookups when the opportunity has no account', async () => {
    const { service } = build();
    await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
      billingAccount: null,
      projectId: null,
      relatedBillingAccounts: [],
    });
    expect(findProject).not.toHaveBeenCalled();
    expect(findChallenges).not.toHaveBeenCalled();
    expect(accountMetadata).not.toHaveBeenCalled();
  });

  it('keeps the account when no non-deleted project currently uses it', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Current account' }]);
    const { service } = build();
    await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
      billingAccount: { id: '22', name: 'Current account' },
      projectId: null,
      relatedBillingAccounts: [],
    });
    expect(findChallenges).not.toHaveBeenCalled();
  });

  it('resolves all unique challenge accounts and retains IDs with missing metadata', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Current' }]);
    findProject.mockResolvedValue({
      id: BigInt(123),
      billingAccountId: BigInt(22),
    });
    findChallenges.mockResolvedValue([
      ...['22', '11', ' 0011 ', '3', '99', '0', '12bad', '', null].map(
        (billingAccountId) => ({ billingRecord: { billingAccountId } }),
      ),
      { billingRecord: null },
    ]);
    accountMetadata.mockResolvedValue({
      '3': { name: 'First', active: false, markup: 0.2 },
      '11': { name: 'Previous', active: false },
    });
    const { service } = build();
    const response = await service.getOpportunity(record.Id);
    expect(response).toMatchObject({
      billingAccount: { id: '22', name: 'Current' },
      projectId: '123',
    });
    expect(response.relatedBillingAccounts).toEqual([
      { id: '3', name: 'First' },
      { id: '11', name: 'Previous' },
      { id: '22', name: 'Current' },
      { id: '99' },
    ]);
    expect(findAccounts).toHaveBeenCalledWith(record.Id);
    expect(findProject).toHaveBeenCalledWith({
      where: { billingAccountId: { in: [BigInt(22)] }, deletedAt: null },
      select: { id: true, billingAccountId: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    expect(findChallenges).toHaveBeenCalledWith({
      where: { projectId: 123 },
      select: { billingRecord: { select: { billingAccountId: true } } },
    });
    expect(accountMetadata).toHaveBeenCalledWith(['3', '11', '99']);
  });

  it('prefers the account used by the matching project over an unassigned newer account', async () => {
    findAccounts.mockResolvedValue([
      { id: '99', name: 'Unassigned' },
      { id: '22', name: 'Current' },
    ]);
    findProject.mockResolvedValue({
      id: BigInt(123),
      billingAccountId: BigInt(22),
    });
    const { service } = build();
    await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
      billingAccount: { id: '22', name: 'Current' },
      projectId: '123',
      relatedBillingAccounts: [],
    });
  });

  it('does not query challenges outside their project ID integer range', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Current' }]);
    findProject.mockResolvedValue({
      id: BigInt('2147483648'),
      billingAccountId: BigInt(22),
    });
    const { service } = build();
    await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
      projectId: '2147483648',
      relatedBillingAccounts: [],
    });
    expect(findChallenges).not.toHaveBeenCalled();
  });

  it('reports challenge lookup failure instead of showing an empty lifetime history', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Current' }]);
    findProject.mockResolvedValue({
      id: BigInt(123),
      billingAccountId: BigInt(22),
    });
    findChallenges.mockRejectedValue(new Error('database connection failed'));
    const { service } = build();
    await expect(service.getOpportunity(record.Id)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
