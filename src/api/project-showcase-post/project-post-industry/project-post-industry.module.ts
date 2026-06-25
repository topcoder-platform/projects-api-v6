import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectPostIndustryController } from './project-post-industry.controller';
import { ProjectPostIndustryService } from './project-post-industry.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [ProjectPostIndustryController],
  providers: [ProjectPostIndustryService],
  exports: [ProjectPostIndustryService],
})
export class ProjectPostIndustryModule {}
