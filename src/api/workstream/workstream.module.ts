import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GlobalProvidersModule } from 'src/shared/modules/global/globalProviders.module';
import { WorkStreamController } from './workstream.controller';
import { WorkStreamService } from './workstream.service';

@Module({
  imports: [HttpModule, GlobalProvidersModule],
  controllers: [WorkStreamController],
  providers: [WorkStreamService],
  exports: [WorkStreamService],
})
export class WorkStreamModule {}
