import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { ProjectTypeController } from './project-type.controller';
import { ProjectTypeService } from './project-type.service';

/**
 * Registers project type controller/service and exports `ProjectTypeService`
 * for metadata consumers.
 */
@Module({
  imports: [GlobalProvidersModule],
  controllers: [ProjectTypeController],
  providers: [ProjectTypeService],
  exports: [ProjectTypeService],
})
export class ProjectTypeModule {}
