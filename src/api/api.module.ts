import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { CopilotModule } from './copilot/copilot.module';
import { ProjectAttachmentModule } from './project-attachment/project-attachment.module';
import { HealthCheckController } from './health-check/healthCheck.controller';
import { MetadataModule } from './metadata/metadata.module';
import { ProjectInviteModule } from './project-invite/project-invite.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectModule } from './project/project.module';

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
  ],
  controllers: [HealthCheckController],
  providers: [],
})
export class ApiModule {}
