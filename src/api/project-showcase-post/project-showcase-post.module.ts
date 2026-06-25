import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectShowcasePostController } from './project-showcase-post.controller';
import { ProjectShowcasePostService } from './project-showcase-post.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [ProjectShowcasePostController],
  providers: [ProjectShowcasePostService],
  exports: [ProjectShowcasePostService],
})
export class ProjectShowcasePostModule {}
