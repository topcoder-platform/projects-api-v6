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

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    PrismaService,
    JwtService,
    {
      provide: LoggerService,
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
export class GlobalProvidersModule {}
