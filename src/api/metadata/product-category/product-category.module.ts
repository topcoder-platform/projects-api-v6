import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryService } from './product-category.service';

/**
 * Registers product category controller/service and exports
 * `ProductCategoryService` for metadata workflows.
 */
@Module({
  imports: [GlobalProvidersModule],
  controllers: [ProductCategoryController],
  providers: [ProductCategoryService],
  exports: [ProductCategoryService],
})
export class ProductCategoryModule {}
