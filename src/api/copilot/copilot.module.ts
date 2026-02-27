import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { CopilotApplicationController } from './copilot-application.controller';
import { CopilotApplicationService } from './copilot-application.service';
import { CopilotNotificationService } from './copilot-notification.service';
import { CopilotOpportunityController } from './copilot-opportunity.controller';
import { CopilotOpportunityService } from './copilot-opportunity.service';
import { CopilotRequestController } from './copilot-request.controller';
import { CopilotRequestService } from './copilot-request.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [
    CopilotRequestController,
    CopilotOpportunityController,
    CopilotApplicationController,
  ],
  providers: [
    CopilotRequestService,
    CopilotOpportunityService,
    CopilotApplicationService,
    CopilotNotificationService,
  ],
})
/**
 * NestJS feature module for the copilot subsystem.
 * Controllers:
 * - CopilotRequestController
 * - CopilotOpportunityController
 * - CopilotApplicationController
 * Providers:
 * - CopilotRequestService
 * - CopilotOpportunityService
 * - CopilotApplicationService
 * - CopilotNotificationService
 * Depends on GlobalProvidersModule for shared PrismaService,
 * PermissionService, and MemberService wiring.
 */
export class CopilotModule {}
