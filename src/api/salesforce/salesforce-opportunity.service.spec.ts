import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesforceOpportunityService } from './salesforce-opportunity.service';
import { SalesforceClient } from './salesforce.client';

describe('SalesforceOpportunityService', () => {
  const record = {
    Id: '006UN00000XamntYAB',
    Name: 'EMEA - Amazon Web Services - PS BFSI',
    Description: ' Pipeline for the BFSI practice ',
    CloseDate: '2026-07-31',
    StageName: 'Qualification',
    Reporting_SMU__c: 'AMR1',
    Subcontracting_End_Customer__r: { Name: 'Novartis Pharmaceuticals' },
  };

  function build(records: unknown[] = [record]): {
    service: SalesforceOpportunityService;
    query: jest.Mock;
  } {
    const query = jest.fn().mockResolvedValue(records);
    const client = {
      query,
      instanceOrigin: () => 'https://topcoder.my.salesforce.com',
    } as unknown as SalesforceClient;
    return { service: new SalesforceOpportunityService(client), query };
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
});
