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
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('TC_Connect_Project_Id__c'),
    );
  });

  it('upgrades a legacy Reporting SMU to the supported option', async () => {
    const { service } = build([{ ...record, Reporting_SMU__c: 'Americas2' }]);

    await expect(
      service.getOpportunity('006UN00000XamntYAB'),
    ).resolves.toMatchObject({ smu: 'AMR2', reportingSmu: 'Americas2' });
  });

  it.each(['AMPE', 'APME', 'APMEA'])(
    'maps Reporting SMU %s to the current AMPE option',
    async (reportingSmu) => {
      const { service } = build([
        { ...record, Reporting_SMU__c: reportingSmu },
      ]);

      await expect(
        service.getOpportunity('006UN00000XamntYAB'),
      ).resolves.toMatchObject({ smu: 'AMPE', reportingSmu });
    },
  );

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

  it.each([' 123 ', 123])(
    'resolves an extension to the original Work project using its explicit reference (%j)',
    async (projectReference) => {
      const originalAccount = { id: '11', name: 'Original contract' };
      const extensionAccount = { id: '22', name: 'October extension' };
      const project = { id: BigInt(123), billingAccountId: BigInt(11) };
      findAccounts
        .mockResolvedValueOnce([originalAccount])
        .mockResolvedValueOnce([extensionAccount]);
      findProject
        .mockResolvedValueOnce(project)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(project);
      findChallenges.mockResolvedValue([
        { billingRecord: { billingAccountId: '11' } },
        { billingRecord: { billingAccountId: '22' } },
      ]);
      accountMetadata.mockResolvedValue({
        '11': originalAccount,
        '22': extensionAccount,
      });
      const original = build();
      const extension = build([
        {
          ...record,
          Id: '006UN00000XamnuYAB',
          Name: 'October extension',
          StageName: 'Won - SOW Signed',
          TC_Connect_Project_Id__c: projectReference,
        },
      ]);

      const originalResponse = await original.service.getOpportunity(record.Id);
      const extensionResponse =
        await extension.service.getOpportunity('006UN00000XamnuYAB');

      expect(extensionResponse).toMatchObject({
        billingAccount: extensionAccount,
        projectId: originalResponse.projectId,
        relatedBillingAccounts: [originalAccount, extensionAccount],
      });
      expect(extensionResponse.projectId).toBe('123');
      expect(findProject).toHaveBeenNthCalledWith(3, {
        where: { id: BigInt(123), deletedAt: null },
        select: { id: true, billingAccountId: true },
      });
      expect(findChallenges).toHaveBeenLastCalledWith({
        where: { projectId: 123 },
        select: { billingRecord: { select: { billingAccountId: true } } },
      });
    },
  );

  it('prefers a current billing-account match over the Salesforce project reference', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Current' }]);
    findProject.mockResolvedValue({
      id: BigInt(456),
      billingAccountId: BigInt(22),
    });
    const { service } = build([{ ...record, TC_Connect_Project_Id__c: '123' }]);

    await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
      projectId: '456',
    });
    expect(findProject).toHaveBeenCalledTimes(1);
  });

  it.each([
    undefined,
    null,
    '',
    '0',
    '-123',
    '123.5',
    '../123',
    'https://connect.topcoder.com/projects/123',
    '9007199254740992',
    9007199254740992,
    {},
    true,
  ])(
    'ignores an unusable Salesforce project reference (%j)',
    async (reference) => {
      findAccounts.mockResolvedValue([{ id: '22', name: 'Extension' }]);
      const { service } = build([
        { ...record, TC_Connect_Project_Id__c: reference },
      ]);

      await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
        billingAccount: { id: '22', name: 'Extension' },
        projectId: null,
        relatedBillingAccounts: [],
      });
      expect(findProject).toHaveBeenCalledTimes(1);
      expect(findChallenges).not.toHaveBeenCalled();
    },
  );

  it('keeps an extension account without a link when the referenced project is missing or deleted', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Extension' }]);
    const { service } = build([{ ...record, TC_Connect_Project_Id__c: '123' }]);

    await expect(service.getOpportunity(record.Id)).resolves.toMatchObject({
      billingAccount: { id: '22', name: 'Extension' },
      projectId: null,
      relatedBillingAccounts: [],
    });
    expect(findProject).toHaveBeenLastCalledWith({
      where: { id: BigInt(123), deletedAt: null },
      select: { id: true, billingAccountId: true },
    });
    expect(findChallenges).not.toHaveBeenCalled();
  });

  it('reports a failed project reference lookup instead of hiding the Work link', async () => {
    findAccounts.mockResolvedValue([{ id: '22', name: 'Extension' }]);
    findProject
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('database connection failed'));
    const { service } = build([{ ...record, TC_Connect_Project_Id__c: '123' }]);

    await expect(service.getOpportunity(record.Id)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(findChallenges).not.toHaveBeenCalled();
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
