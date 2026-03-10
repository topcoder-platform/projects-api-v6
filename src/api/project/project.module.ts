import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  imports: [HttpModule, GlobalProvidersModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
/**
 * Project feature module.
 *
 * Registers `ProjectController` and `ProjectService`, imports `HttpModule`
 * for billing-account HTTP integrations and `GlobalProvidersModule`, and
 * exports `ProjectService` for reuse by other feature modules.
 */
export class ProjectModule {}
