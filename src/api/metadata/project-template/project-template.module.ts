import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { FormModule } from '../form/form.module';
import { PlanConfigModule } from '../plan-config/plan-config.module';
import { PriceConfigModule } from '../price-config/price-config.module';
import { ProjectTemplateController } from './project-template.controller';
import { ProjectTemplateService } from './project-template.service';

/**
 * Registers project template controller/service and exports
 * `ProjectTemplateService` for metadata APIs and dependent services.
 */
@Module({
  imports: [
    GlobalProvidersModule,
    FormModule,
    PlanConfigModule,
    PriceConfigModule,
  ],
  controllers: [ProjectTemplateController],
  providers: [ProjectTemplateService],
  exports: [ProjectTemplateService],
})
export class ProjectTemplateModule {}
