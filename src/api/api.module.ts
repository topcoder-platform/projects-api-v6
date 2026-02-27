// TODO (quality): HttpModule is already provided by GlobalProvidersModule (which is @Global()). Verify whether any provider in ApiModule directly depends on it at this level; if not, remove this import.
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
// TODO (quality): GlobalProvidersModule is decorated @Global() and is already imported in AppModule. Importing it again here is redundant. Remove this import from ApiModule.
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { CopilotModule } from './copilot/copilot.module';
import { PhaseProductModule } from './phase-product/phase-product.module';
import { ProjectAttachmentModule } from './project-attachment/project-attachment.module';
import { HealthCheckController } from './health-check/healthCheck.controller';
import { MetadataModule } from './metadata/metadata.module';
import { ProjectInviteModule } from './project-invite/project-invite.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectPhaseModule } from './project-phase/project-phase.module';
import { ProjectSettingModule } from './project-setting/project-setting.module';
import { ProjectModule } from './project/project.module';

/**
 * Feature aggregation module for all API routes in the Topcoder Project API v6.
 *
 * Imports and re-exports every domain feature module:
 * - ProjectModule           - CRUD for projects
 * - ProjectMemberModule     - project membership management
 * - ProjectInviteModule     - invitation workflow
 * - ProjectAttachmentModule - file attachments
 * - ProjectPhaseModule      - project phases
 * - PhaseProductModule      - products within phases
 * - ProjectSettingModule    - per-project settings
 * - CopilotModule           - copilot request/opportunity/application flow
 * - MetadataModule          - reference metadata (categories, skills, etc.)
 *
 * Also registers HealthCheckController directly (not via a sub-module).
 *
 * Consumed by: AppModule (imported once at the root).
 * Swagger: main.ts includes this module when building the OpenAPI document.
 */
@Module({
  imports: [
    HttpModule,
    GlobalProvidersModule,
    CopilotModule,
    MetadataModule,
    ProjectModule,
    ProjectMemberModule,
    ProjectInviteModule,
    ProjectAttachmentModule,
    ProjectPhaseModule,
    PhaseProductModule,
    ProjectSettingModule,
    // TODO (quality): WorkStreamModule is included in the Swagger document in main.ts but is not imported here. Add WorkStreamModule to this imports array so its routes are part of the same module graph, or remove it from the Swagger include list.
  ],
  controllers: [HealthCheckController],
  providers: [],
})
export class ApiModule {}
