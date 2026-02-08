import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { PlanConfigController } from './plan-config.controller';
import { PlanConfigRevisionController } from './plan-config-revision.controller';
import { PlanConfigVersionController } from './plan-config-version.controller';
import { PlanConfigService } from './plan-config.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [
    PlanConfigController,
    PlanConfigVersionController,
    PlanConfigRevisionController,
  ],
  providers: [PlanConfigService],
  exports: [PlanConfigService],
})
export class PlanConfigModule {}
