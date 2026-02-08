import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WorkStreamModule } from 'src/api/workstream/workstream.module';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectPhaseController } from './project-phase.controller';
import { ProjectPhaseService } from './project-phase.service';
import { WorkController } from './work.controller';

@Module({
  imports: [HttpModule, GlobalProvidersModule, WorkStreamModule],
  controllers: [ProjectPhaseController, WorkController],
  providers: [ProjectPhaseService],
  exports: [ProjectPhaseService],
})
export class ProjectPhaseModule {}
