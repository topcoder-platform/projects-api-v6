import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { FormModule } from '../form/form.module';
import { ProductTemplateController } from './product-template.controller';
import { ProductTemplateService } from './product-template.service';

/**
 * Registers product template controller/service and exports
 * `ProductTemplateService` for metadata composition and validation flows.
 */
@Module({
  imports: [GlobalProvidersModule, FormModule],
  controllers: [ProductTemplateController],
  providers: [ProductTemplateService],
  exports: [ProductTemplateService],
})
export class ProductTemplateModule {}
