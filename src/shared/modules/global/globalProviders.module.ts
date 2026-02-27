import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { BillingAccountService } from 'src/shared/services/billingAccount.service';
import { EmailService } from 'src/shared/services/email.service';
import { FileService } from 'src/shared/services/file.service';
import { IdentityService } from 'src/shared/services/identity.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { EventBusService } from './eventBus.service';
import { JwtService } from './jwt.service';
import { LoggerService } from './logger.service';
import { M2MService } from './m2m.service';
import { PrismaErrorService } from './prisma-error.service';
import { PrismaService } from './prisma.service';

/**
 * Global providers module.
 *
 * Acts as the single registration point for cross-cutting infrastructure and
 * shared integration services:
 * - PrismaService: database client and lifecycle management
 * - PrismaErrorService: Prisma-to-HTTP exception translation
 * - JwtService: token validation and user extraction
 * - LoggerService: application logging abstraction
 * - M2MService: machine-token acquisition and scope utilities
 * - EventBusService: event publishing to bus/Kafka
 * - PermissionService: authorization checks
 * - BillingAccountService/MemberService/IdentityService/EmailService/FileService: external integration services
 */
@Global()
@Module({
  // TODO (quality): HttpModule is imported without configuration (timeout, baseURL). Consider providing a global HttpModule with sensible defaults (e.g., a request timeout) to prevent hanging HTTP calls in shared services.
  imports: [HttpModule],
  providers: [
    PrismaService,
    JwtService,
    {
      provide: LoggerService,
      // TODO (quality): LoggerService is provided via factory with a fixed 'Global' context. However, all individual services call LoggerService.forRoot() directly, bypassing DI. Either standardise on DI injection with setContext(), or remove the factory provider and document that LoggerService is not injected.
      useFactory: () => {
        return new LoggerService('Global');
      },
    },
    PrismaErrorService,
    M2MService,
    PermissionService,
    EventBusService,
    BillingAccountService,
    MemberService,
    IdentityService,
    EmailService,
    FileService,
  ],
  exports: [
    PrismaService,
    JwtService,
    LoggerService,
    PrismaErrorService,
    M2MService,
    PermissionService,
    EventBusService,
    BillingAccountService,
    MemberService,
    IdentityService,
    EmailService,
    FileService,
  ],
})
/**
 * Exports globally shared infrastructure providers for the application.
 */
export class GlobalProvidersModule {}
