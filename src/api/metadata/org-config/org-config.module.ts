import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { OrgConfigController } from './org-config.controller';
import { OrgConfigService } from './org-config.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [OrgConfigController],
  providers: [OrgConfigService],
  exports: [OrgConfigService],
})
export class OrgConfigModule {}
