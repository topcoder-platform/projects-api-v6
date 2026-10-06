import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { SalesforceOpportunityController } from './salesforce-opportunity.controller';
import { SalesforceOpportunityService } from './salesforce-opportunity.service';
import { SalesforceClient } from './salesforce.client';

/**
 * Wires Salesforce opportunity reads with project and billing-account lookups.
 *
 * The client keeps its OAuth session in memory only; no Salesforce data is
 * persisted by this module.
 */
@Module({
  imports: [GlobalProvidersModule],
  controllers: [SalesforceOpportunityController],
  providers: [SalesforceClient, SalesforceOpportunityService],
  exports: [SalesforceOpportunityService],
})
export class SalesforceModule {}
