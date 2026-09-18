import { Reflector } from '@nestjs/core';
import { MANAGER_ROLES, UserRole } from 'src/shared/enums/userRole.enum';
import { ROLES_KEY } from 'src/shared/guards/tokenRoles.guard';
import { SalesforceOpportunityController } from './salesforce-opportunity.controller';
import { SalesforceOpportunityService } from './salesforce-opportunity.service';

describe('SalesforceOpportunityController', () => {
  const opportunity = {
    id: '006UN00000XamntYAB',
    name: 'EMEA - Amazon Web Services - PS BFSI',
    url: 'https://topcoder.my.salesforce.com/006UN00000XamntYAB',
  };

  it('returns the opportunity resolved by the service', async () => {
    const getOpportunity = jest.fn().mockResolvedValue(opportunity);
    const controller = new SalesforceOpportunityController({
      getOpportunity,
    } as unknown as SalesforceOpportunityService);

    await expect(controller.getOpportunity('006UN00000XamntYAB')).resolves.toBe(
      opportunity,
    );
    expect(getOpportunity).toHaveBeenCalledWith('006UN00000XamntYAB');
  });

  it('is restricted to manager-tier and talent-manager roles', () => {
    const handler = Object.getOwnPropertyDescriptor(
      SalesforceOpportunityController.prototype,
      'getOpportunity',
    )?.value as () => unknown;
    const roles = new Reflector().get<string[]>(ROLES_KEY, handler);

    expect(roles).toEqual(
      expect.arrayContaining([
        ...MANAGER_ROLES,
        UserRole.TALENT_MANAGER,
        UserRole.TOPCODER_TALENT_MANAGER,
      ]),
    );
    expect(roles).not.toContain(UserRole.TOPCODER_USER);
  });
});
