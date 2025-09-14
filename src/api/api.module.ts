import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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

@Module({
  imports: [SharedModule],
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
    ProjectService,
    ProjectMemberService,
    ProjectMemberInviteService,
    ProjectAttachmentService,
    BillingAccountService,
    PermissionService,
  ],
})
export class ApiModule {}
