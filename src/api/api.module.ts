import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { CopilotModule } from './copilot/copilot.module';
import { MilestoneModule } from './milestone/milestone.module';
import { PhaseProductModule } from './phase-product/phase-product.module';
import { ProjectAttachmentModule } from './project-attachment/project-attachment.module';
import { HealthCheckController } from './health-check/healthCheck.controller';
import { MetadataModule } from './metadata/metadata.module';
import { ProjectInviteModule } from './project-invite/project-invite.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectPhaseModule } from './project-phase/project-phase.module';
import { ProjectSettingModule } from './project-setting/project-setting.module';
import { ProjectModule } from './project/project.module';
import { TimelineModule } from './timeline/timeline.module';
import { WorkStreamModule } from './workstream/workstream.module';

@Module({
  imports: [
    HttpModule,
    GlobalProvidersModule,
    CopilotModule,
    MetadataModule,
    ProjectModule,
    ProjectSettingModule,
    ProjectMemberModule,
    ProjectInviteModule,
    ProjectAttachmentModule,
    WorkStreamModule,
    ProjectPhaseModule,
    PhaseProductModule,
    TimelineModule,
    MilestoneModule,
  ],
  controllers: [HealthCheckController],
  providers: [],
})
export class ApiModule {}
