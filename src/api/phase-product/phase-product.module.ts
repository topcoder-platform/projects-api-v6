import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { WorkStreamModule } from 'src/api/workstream/workstream.module';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { PhaseProductController } from './phase-product.controller';
import { PhaseProductService } from './phase-product.service';
import { WorkItemController } from './workitem.controller';

@Module({
  imports: [HttpModule, GlobalProvidersModule, WorkStreamModule],
  controllers: [PhaseProductController, WorkItemController],
  providers: [PhaseProductService],
  exports: [PhaseProductService],
})
/**
 * NestJS feature module for phase products (work items). Registers
 * `PhaseProductController` and `WorkItemController`. Exports
 * `PhaseProductService`.
 */
export class PhaseProductModule {}
