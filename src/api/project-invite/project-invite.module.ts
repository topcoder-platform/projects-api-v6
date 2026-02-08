import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectInviteController } from './project-invite.controller';
import { ProjectInviteService } from './project-invite.service';

@Module({
  imports: [HttpModule, GlobalProvidersModule],
  controllers: [ProjectInviteController],
  providers: [ProjectInviteService],
  exports: [ProjectInviteService],
})
export class ProjectInviteModule {}
