import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectPostCategoryController } from './project-post-category.controller';
import { ProjectPostCategoryService } from './project-post-category.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [ProjectPostCategoryController],
  providers: [ProjectPostCategoryService],
  exports: [ProjectPostCategoryService],
})
export class ProjectPostCategoryModule {}
