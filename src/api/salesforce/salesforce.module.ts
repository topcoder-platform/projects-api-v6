import { Module } from '@nestjs/common';
import { SalesforceOpportunityController } from './salesforce-opportunity.controller';
import { SalesforceOpportunityService } from './salesforce-opportunity.service';
import { SalesforceClient } from './salesforce.client';

/**
 * Wires the read-only Salesforce opportunity integration.
 *
 * The client keeps its OAuth session in memory only; no Salesforce data is
 * persisted by this module.
 */
@Module({
  controllers: [SalesforceOpportunityController],
  providers: [SalesforceClient, SalesforceOpportunityService],
  exports: [SalesforceOpportunityService],
})
export class SalesforceModule {}
