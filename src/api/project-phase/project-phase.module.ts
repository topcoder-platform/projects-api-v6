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
/**
 * NestJS feature module for project phases (works). Registers
 * `ProjectPhaseController` (classic `/phases` routes) and `WorkController`
 * (workstream-scoped `/works` routes). Exports `ProjectPhaseService` for use
 * by `WorkController` and other consumers. Includes `WorkStreamModule` to
 * support work-stream linkage flows.
 */
export class ProjectPhaseModule {}
