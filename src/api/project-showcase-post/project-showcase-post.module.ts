import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectShowcasePostController } from './project-showcase-post.controller';
import { ProjectShowcasePostService } from './project-showcase-post.service';
import { ProjectPostCategoryModule } from './project-post-category/project-post-category.module';
import { ProjectPostIndustryModule } from './project-post-industry/project-post-industry.module';

@Module({
  imports: [
    GlobalProvidersModule,
    ProjectPostCategoryModule,
    ProjectPostIndustryModule,
  ],
  controllers: [ProjectShowcasePostController],
  providers: [ProjectShowcasePostService],
  exports: [ProjectShowcasePostService],
})
export class ProjectShowcasePostModule {}
