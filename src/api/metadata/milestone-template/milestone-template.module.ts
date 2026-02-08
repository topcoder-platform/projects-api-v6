import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { MilestoneTemplateController } from './milestone-template.controller';
import { MilestoneTemplateService } from './milestone-template.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [MilestoneTemplateController],
  providers: [MilestoneTemplateService],
  exports: [MilestoneTemplateService],
})
export class MilestoneTemplateModule {}
