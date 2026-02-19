import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { MilestoneTemplateService } from './milestone-template.service';

@Module({
  imports: [GlobalProvidersModule],
  providers: [MilestoneTemplateService],
  exports: [MilestoneTemplateService],
})
export class MilestoneTemplateModule {}
