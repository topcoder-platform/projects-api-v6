import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { PriceConfigController } from './price-config.controller';
import { PriceConfigRevisionController } from './price-config-revision.controller';
import { PriceConfigVersionController } from './price-config-version.controller';
import { PriceConfigService } from './price-config.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [
    PriceConfigController,
    PriceConfigVersionController,
    PriceConfigRevisionController,
  ],
  providers: [PriceConfigService],
  exports: [PriceConfigService],
})
export class PriceConfigModule {}
