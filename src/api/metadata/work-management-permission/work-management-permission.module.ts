import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { WorkManagementPermissionController } from './work-management-permission.controller';
import { WorkManagementPermissionService } from './work-management-permission.service';

/**
 * Registers work management permission controller/service and exports the
 * service for authorization-aware metadata workflows.
 */
@Module({
  imports: [GlobalProvidersModule],
  controllers: [WorkManagementPermissionController],
  providers: [WorkManagementPermissionService],
  exports: [WorkManagementPermissionService],
})
export class WorkManagementPermissionModule {}
