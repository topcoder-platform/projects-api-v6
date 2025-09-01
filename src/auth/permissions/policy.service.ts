import { Injectable, OnModuleInit } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/shared/services/prisma.service';
import { PERMISSION, PermissionRule } from './constants';
import { GeneralPermission, ProjectView } from './policy.handler';

/**
 * define request handler type
 */
export type AsyncRequestHandler = (req: Request) => Promise<void>;

/**
 * define policy handler type
 */
export type PolicyHandler = (
  permission: PermissionRule | PermissionRule[],
) => AsyncRequestHandler;

@Injectable()
export class PolicyService implements OnModuleInit {
  // remember all handlers for each policy
  private readonly handlers: Record<string, AsyncRequestHandler>;

  constructor(private readonly prisma: PrismaService) {
    this.handlers = {};
  }

  async onModuleInit() {
    await this.registerAllPolicy();
  }

  /**
   * Register all policy handlers.
   * Copied from tc-project-service/src/permissions/index.js
   */
  private async registerAllPolicy() {
    // project
    await this.registerPolicy(
      'project.create',
      GeneralPermission(PERMISSION.CREATE_PROJECT, this.prisma),
    );
    await this.registerPolicy(
      'project.view',
      GeneralPermission(PERMISSION.CREATE_PROJECT, this.prisma),
    );
    await this.registerPolicy(
      'project.edit',
      GeneralPermission(PERMISSION.CREATE_PROJECT, this.prisma),
    );
    await this.registerPolicy(
      'project.delete',
      GeneralPermission(PERMISSION.CREATE_PROJECT, this.prisma),
    );
    // permissions
    await this.registerPolicy('permissions.view', ProjectView(this.prisma));
    // attachment
    await this.registerPolicy(
      'projectAttachment.create',
      GeneralPermission(PERMISSION.CREATE_PROJECT_ATTACHMENT, this.prisma),
    );
    await this.registerPolicy(
      'projectAttachment.view',
      GeneralPermission(
        [
          PERMISSION.READ_PROJECT_ATTACHMENT_OWN_OR_ALLOWED,
          PERMISSION.READ_PROJECT_ATTACHMENT_NOT_OWN_AND_NOT_ALLOWED,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectAttachment.edit',
      GeneralPermission(
        [
          PERMISSION.UPDATE_PROJECT_ATTACHMENT_OWN,
          PERMISSION.UPDATE_PROJECT_ATTACHMENT_NOT_OWN,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectAttachment.delete',
      GeneralPermission(
        [
          PERMISSION.DELETE_PROJECT_ATTACHMENT_OWN,
          PERMISSION.DELETE_PROJECT_ATTACHMENT_NOT_OWN,
        ],
        this.prisma,
      ),
    );
    // billing account
    await this.registerPolicy(
      'projectBillingAccounts.view',
      GeneralPermission(
        [PERMISSION.READ_AVL_PROJECT_BILLING_ACCOUNTS],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectBillingAccount.view',
      GeneralPermission(
        [PERMISSION.READ_PROJECT_BILLING_ACCOUNT_DETAILS],
        this.prisma,
      ),
    );
    // project member
    await this.registerPolicy(
      'projectMember.create',
      GeneralPermission(
        [
          PERMISSION.CREATE_PROJECT_MEMBER_OWN,
          PERMISSION.CREATE_PROJECT_MEMBER_NOT_OWN,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectMember.view',
      GeneralPermission(PERMISSION.READ_PROJECT_MEMBER, this.prisma),
    );
    await this.registerPolicy(
      'projectMember.edit',
      GeneralPermission(
        [
          PERMISSION.UPDATE_PROJECT_MEMBER_CUSTOMER,
          PERMISSION.UPDATE_PROJECT_MEMBER_NON_CUSTOMER,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectMember.delete',
      GeneralPermission(
        [
          PERMISSION.DELETE_PROJECT_MEMBER_CUSTOMER,
          PERMISSION.DELETE_PROJECT_MEMBER_TOPCODER,
          PERMISSION.DELETE_PROJECT_MEMBER_COPILOT,
        ],
        this.prisma,
      ),
    );
    // project member invites
    await this.registerPolicy(
      'projectMemberInvite.create',
      GeneralPermission(
        [
          PERMISSION.CREATE_PROJECT_INVITE_CUSTOMER,
          PERMISSION.CREATE_PROJECT_INVITE_TOPCODER,
          PERMISSION.CREATE_PROJECT_INVITE_COPILOT,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectMemberInvite.view',
      GeneralPermission(
        [
          PERMISSION.READ_PROJECT_INVITE_OWN,
          PERMISSION.READ_PROJECT_INVITE_NOT_OWN,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectMemberInvite.edit',
      GeneralPermission(
        [
          PERMISSION.UPDATE_PROJECT_INVITE_OWN,
          PERMISSION.UPDATE_PROJECT_INVITE_NOT_OWN,
        ],
        this.prisma,
      ),
    );
    await this.registerPolicy(
      'projectMemberInvite.delete',
      GeneralPermission(
        [
          PERMISSION.DELETE_PROJECT_INVITE_OWN,
          PERMISSION.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER,
          PERMISSION.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT,
          PERMISSION.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER,
        ],
        this.prisma,
      ),
    );
  }

  /**
   * Get policy handler for policy if any.
   * @param policyName policy name
   * @returns request handler if found
   */
  getPolicyHandler(policyName: string) {
    return this.handlers[policyName] || null;
  }

  /**
   * Register handler for specific handler
   * @param policyName policy name
   * @param handler request handler
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async registerPolicy(
    policyName: string,
    handler: AsyncRequestHandler,
  ) {
    this.handlers[policyName] = handler;
  }
}
