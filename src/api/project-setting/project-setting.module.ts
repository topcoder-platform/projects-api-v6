import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectSettingController } from './project-setting.controller';
import { ProjectSettingService } from './project-setting.service';

@Module({
  imports: [HttpModule, GlobalProvidersModule],
  controllers: [ProjectSettingController],
  providers: [ProjectSettingService],
  exports: [ProjectSettingService],
})
export class ProjectSettingModule {}
