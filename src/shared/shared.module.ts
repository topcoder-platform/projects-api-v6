import { Global, Module } from '@nestjs/common';
import { M2MService } from './services/m2m.service';
import { PrismaService } from './services/prisma.service';
import { EventBusService } from './services/event-bus.service';
@Global()
@Module({
  imports: [],
  providers: [
    M2MService,
    PrismaService,
    EventBusService,
  ],
  exports: [
    M2MService,
    PrismaService,
    EventBusService,
  ],
})
export class SharedModule {}
