import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { TimelineController } from './timeline.controller';
import { TimelineProjectContextGuard } from './guards/timeline-project-context.guard';
import { TimelineReferenceService } from './timeline-reference.service';
import { TimelineService } from './timeline.service';

@Module({
  imports: [GlobalProvidersModule],
  controllers: [TimelineController],
  providers: [
    TimelineService,
    TimelineReferenceService,
    TimelineProjectContextGuard,
  ],
  exports: [
    TimelineService,
    TimelineReferenceService,
    TimelineProjectContextGuard,
  ],
})
export class TimelineModule {}
