import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { M2MService } from './services/m2m.service';
import { PrismaService } from './services/prisma.service';
import { EventBusService } from './services/event-bus.service';
import { UtilService } from './services/util.service';
import { SalesforceService } from './services/salesforce.service';
@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // Default timeout for HTTP requests
      maxRedirects: 3,
    }),
  ],
  providers: [
    M2MService,
    PrismaService,
    EventBusService,
    UtilService,
    SalesforceService,
  ],
  exports: [
    M2MService,
    PrismaService,
    EventBusService,
    UtilService,
    SalesforceService,
  ],
})
export class SharedModule {}
