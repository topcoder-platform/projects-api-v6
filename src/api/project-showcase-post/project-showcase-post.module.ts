import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectShowcasePostController } from './project-showcase-post.controller';
import { ProjectShowcasePostService } from './project-showcase-post.service';
import { ProjectPostCategoryController } from './project-post-category/project-post-category.controller';
import { ProjectPostIndustryController } from './project-post-industry/project-post-industry.controller';
import { ProjectPostCategoryService } from './project-post-category/project-post-category.service';
import { ProjectPostIndustryService } from './project-post-industry/project-post-industry.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [
    ProjectShowcasePostController,
    ProjectPostCategoryController,
    ProjectPostIndustryController,
  ],
  providers: [
    ProjectShowcasePostService,
    ProjectPostCategoryService,
    ProjectPostIndustryService,
  ],
  exports: [ProjectShowcasePostService],
})
export class ProjectShowcasePostModule {}
