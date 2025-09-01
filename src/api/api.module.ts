import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { PermissionGuard } from 'src/auth/guards/permissions.guard';
import { SharedModule } from 'src/shared/shared.module';
import { HealthController } from './health/health.controller';
import { ProjectMemberController } from './projectMember/project-member.controller';
import { ProjectMemberService } from './projectMember/project-member.service';
import { ProjectMemberInviteController } from './projectMemberInvite/project-member-invite.controller';
import { ProjectMemberInviteService } from './projectMemberInvite/project-member-invite.service';
import { ProjectAttachmentController } from './projectAttachment/project-attachment.controller';
import { ProjectAttachmentService } from './projectAttachment/project-attachment.service';
import { BillingAccountController } from './projectBillingAccount/billing-account.controller';
import { BillingAccountService } from './projectBillingAccount/billing-account.service';
import { PermissionController } from './permission/permission.controller';
import { PermissionService } from './permission/permission.service';
import { ProjectsController } from './project/project.controller';
import { ProjectService } from './project/project.service';
import { AuthModule } from 'src/auth/auth.module';
import { PolicyService } from 'src/auth/permissions/policy.service';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [
    HealthController,
    ProjectsController,
    ProjectMemberController,
    ProjectMemberInviteController,
    ProjectAttachmentController,
    BillingAccountController,
    PermissionController,
  ],
  providers: [
    Reflector,
    PolicyService,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    ProjectService,
    ProjectMemberService,
    ProjectMemberInviteService,
    ProjectAttachmentService,
    BillingAccountService,
    PermissionService,
  ],
})
export class ApiModule {}
