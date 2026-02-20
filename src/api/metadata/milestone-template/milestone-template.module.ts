import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { MilestoneTemplateService } from './milestone-template.service';

/**
 * Registers milestone template service and exports it for metadata operations.
 *
 * Note: this module is currently not imported by `MetadataModule`.
 */
@Module({
  imports: [GlobalProvidersModule],
  providers: [MilestoneTemplateService],
  exports: [MilestoneTemplateService],
})
export class MilestoneTemplateModule {}
