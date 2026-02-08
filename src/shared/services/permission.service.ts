import { Injectable } from '@nestjs/common';
import { Permission as NamedPermission } from '../constants/permissions';
import { DEFAULT_PROJECT_ROLE } from '../constants/permissions.constants';
import {
  ProjectMemberRole,
  PROJECT_MEMBER_MANAGER_ROLES,
} from '../enums/projectMemberRole.enum';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, UserRole } from '../enums/userRole.enum';
import {
  Permission,
  PermissionRule,
  ProjectInvite,
  ProjectMember,
  ProjectRoleRule,
} from '../interfaces/permission.interface';
import { JwtUser } from '../modules/global/jwt.service';
import { M2MService } from '../modules/global/m2m.service';

@Injectable()
export class PermissionService {
  constructor(private readonly m2mService: M2MService) {}

  matchPermissionRule(
    permissionRule: PermissionRule | null | undefined,
    user: JwtUser,
    projectMembers?: ProjectMember[],
  ): boolean {
    let hasProjectRole = false;
    let hasTopcoderRole = false;
    let hasScope = false;

    if (!permissionRule || !user) {
      return false;
    }

    if (permissionRule.projectRoles && projectMembers) {
      const member = this.getProjectMember(user.userId, projectMembers);

      if (Array.isArray(permissionRule.projectRoles)) {
        const normalizedProjectRoles = permissionRule.projectRoles.map(
          (rule) => (typeof rule === 'string' ? { role: rule } : rule),
        );

        hasProjectRole = Boolean(
          member &&
          normalizedProjectRoles.some((rule) =>
            this.matchProjectRoleRule(member, rule),
          ),
        );
      } else if (permissionRule.projectRoles === true) {
        hasProjectRole = Boolean(member);
      }
    }

    if (permissionRule.topcoderRoles) {
      if (Array.isArray(permissionRule.topcoderRoles)) {
        hasTopcoderRole = this.hasIntersection(
          user.roles || [],
          permissionRule.topcoderRoles,
        );
      } else if (permissionRule.topcoderRoles === true) {
        hasTopcoderRole = (user.roles || []).length > 0;
      }
    }

    if (permissionRule.scopes) {
      hasScope = this.m2mService.hasRequiredScopes(
        user.scopes || [],
        permissionRule.scopes,
      );
    }

    return hasProjectRole || hasTopcoderRole || hasScope;
  }

  hasPermission(
    permission: Permission | null | undefined,
    user: JwtUser,
    projectMembers?: ProjectMember[],
  ): boolean {
    if (!permission || !user) {
      return false;
    }

    const allowRule = permission.allowRule || permission;
    const denyRule = permission.denyRule || null;

    const allow = this.matchPermissionRule(allowRule, user, projectMembers);
    const deny = this.matchPermissionRule(denyRule, user, projectMembers);

    return allow && !deny;
  }

  hasNamedPermission(
    permission: NamedPermission,
    user: JwtUser,
    projectMembers: ProjectMember[] = [],
    projectInvites: ProjectInvite[] = [],
  ): boolean {
    if (!user) {
      return false;
    }

    const isAuthenticated =
      Boolean(user.userId && String(user.userId).trim().length > 0) ||
      (Array.isArray(user.roles) && user.roles.length > 0) ||
      (Array.isArray(user.scopes) && user.scopes.length > 0) ||
      user.isMachine;

    const isAdmin = this.hasIntersection(user.roles || [], [
      ...ADMIN_ROLES,
      UserRole.MANAGER,
      'topcoder_manager',
    ]);
    const hasStrictAdminAccess =
      this.hasIntersection(user.roles || [], ADMIN_ROLES) ||
      this.m2mService.hasRequiredScopes(user.scopes || [], [
        Scope.CONNECT_PROJECT_ADMIN,
      ]);

    const member = this.getProjectMember(user.userId, projectMembers);
    const hasProjectMembership = Boolean(member);

    const isManagementMember = Boolean(
      member &&
      PROJECT_MEMBER_MANAGER_ROLES.some(
        (role) => this.normalizeRole(member.role) === this.normalizeRole(role),
      ),
    );

    const hasPendingInvite = projectInvites.some((invite) => {
      if (this.normalizeRole(invite.status) !== 'pending') {
        return false;
      }

      if (!invite.userId) {
        return false;
      }

      return (
        this.normalizeUserId(invite.userId) ===
        this.normalizeUserId(user.userId)
      );
    });

    switch (permission) {
      case NamedPermission.READ_PROJECT_ANY:
        return isAdmin;

      case NamedPermission.VIEW_PROJECT:
        return isAdmin || hasProjectMembership || hasPendingInvite;

      case NamedPermission.CREATE_PROJECT:
        return isAuthenticated;

      case NamedPermission.EDIT_PROJECT:
        return isAdmin || isManagementMember || this.isCopilot(member?.role);

      case NamedPermission.DELETE_PROJECT:
        return (
          isAdmin ||
          Boolean(
            member &&
            this.normalizeRole(member.role) ===
              this.normalizeRole(ProjectMemberRole.MANAGER),
          )
        );

      case NamedPermission.READ_PROJECT_MEMBER:
        return isAdmin || hasProjectMembership;

      case NamedPermission.CREATE_PROJECT_MEMBER_OWN:
        return isAuthenticated;

      case NamedPermission.CREATE_PROJECT_MEMBER_NOT_OWN:
      case NamedPermission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER:
      case NamedPermission.DELETE_PROJECT_MEMBER_TOPCODER:
        return isAdmin || isManagementMember;

      case NamedPermission.DELETE_PROJECT_MEMBER_CUSTOMER:
        return isAdmin || isManagementMember || this.isCopilot(member?.role);

      case NamedPermission.DELETE_PROJECT_MEMBER_COPILOT:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasCopilotManagerRole(user)
        );

      case NamedPermission.READ_PROJECT_INVITE_OWN:
        return isAuthenticated;

      case NamedPermission.READ_PROJECT_INVITE_NOT_OWN:
        return isAdmin || hasProjectMembership;

      case NamedPermission.CREATE_PROJECT_INVITE_TOPCODER:
        return isAdmin || isManagementMember;

      case NamedPermission.CREATE_PROJECT_INVITE_CUSTOMER:
        return isAdmin || isManagementMember || this.isCopilot(member?.role);

      case NamedPermission.CREATE_PROJECT_INVITE_COPILOT:
        return isAdmin || this.hasCopilotManagerRole(user);

      case NamedPermission.UPDATE_PROJECT_INVITE_OWN:
      case NamedPermission.DELETE_PROJECT_INVITE_OWN:
        return isAuthenticated;

      case NamedPermission.UPDATE_PROJECT_INVITE_REQUESTED:
      case NamedPermission.DELETE_PROJECT_INVITE_REQUESTED:
        return (
          isAdmin || isManagementMember || this.hasCopilotManagerRole(user)
        );

      case NamedPermission.UPDATE_PROJECT_INVITE_NOT_OWN:
      case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER:
        return isAdmin || isManagementMember;

      case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER:
        return isAdmin || isManagementMember || this.isCopilot(member?.role);

      case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasCopilotManagerRole(user)
        );

      case NamedPermission.MANAGE_PROJECT_BILLING_ACCOUNT_ID:
      case NamedPermission.MANAGE_PROJECT_DIRECT_PROJECT_ID:
        return isAdmin;

      case NamedPermission.MANAGE_COPILOT_REQUEST:
      case NamedPermission.ASSIGN_COPILOT_OPPORTUNITY:
      case NamedPermission.CANCEL_COPILOT_OPPORTUNITY:
        return this.hasIntersection(user.roles || [], [
          UserRole.TOPCODER_ADMIN,
          UserRole.PROJECT_MANAGER,
        ]);

      case NamedPermission.APPLY_COPILOT_OPPORTUNITY:
        return this.hasIntersection(user.roles || [], [UserRole.TC_COPILOT]);

      case NamedPermission.CREATE_PROJECT_AS_MANAGER:
        return this.hasIntersection(user.roles || [], [
          ...ADMIN_ROLES,
          UserRole.CONNECT_ADMIN,
        ]);

      case NamedPermission.VIEW_PROJECT_ATTACHMENT:
        return isAdmin || hasProjectMembership;

      case NamedPermission.CREATE_PROJECT_ATTACHMENT:
      case NamedPermission.EDIT_PROJECT_ATTACHMENT:
      case NamedPermission.DELETE_PROJECT_ATTACHMENT:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.isCustomer(member?.role)
        );

      case NamedPermission.UPDATE_PROJECT_ATTACHMENT_NOT_OWN:
        return isAdmin;

      case NamedPermission.ADD_PROJECT_PHASE:
      case NamedPermission.UPDATE_PROJECT_PHASE:
      case NamedPermission.DELETE_PROJECT_PHASE:
      case NamedPermission.ADD_PHASE_PRODUCT:
      case NamedPermission.UPDATE_PHASE_PRODUCT:
      case NamedPermission.DELETE_PHASE_PRODUCT:
      case NamedPermission.WORKSTREAM_CREATE:
      case NamedPermission.WORKSTREAM_EDIT:
      case NamedPermission.WORK_CREATE:
      case NamedPermission.WORK_EDIT:
      case NamedPermission.WORKITEM_CREATE:
      case NamedPermission.WORKITEM_EDIT:
        return isAdmin || isManagementMember || this.isCopilot(member?.role);

      case NamedPermission.WORKSTREAM_VIEW:
      case NamedPermission.WORK_VIEW:
      case NamedPermission.WORKITEM_VIEW:
        return isAdmin || hasProjectMembership;

      case NamedPermission.WORKSTREAM_DELETE:
      case NamedPermission.WORK_DELETE:
      case NamedPermission.WORKITEM_DELETE:
        return isAdmin || isManagementMember;

      case NamedPermission.WORK_MANAGEMENT_PERMISSION_VIEW:
        return isAuthenticated;

      case NamedPermission.WORK_MANAGEMENT_PERMISSION_EDIT:
        return hasStrictAdminAccess;

      default:
        return false;
    }
  }

  isPermissionRequireProjectMembers(
    permission: Permission | null | undefined,
  ): boolean {
    if (!permission) {
      return false;
    }

    const allowRule = permission.allowRule || permission;
    const denyRule = permission.denyRule || null;

    return (
      typeof allowRule.projectRoles !== 'undefined' ||
      typeof denyRule?.projectRoles !== 'undefined'
    );
  }

  isNamedPermissionRequireProjectMembers(permission: NamedPermission): boolean {
    return [
      NamedPermission.VIEW_PROJECT,
      NamedPermission.EDIT_PROJECT,
      NamedPermission.DELETE_PROJECT,
      NamedPermission.READ_PROJECT_MEMBER,
      NamedPermission.READ_PROJECT_INVITE_NOT_OWN,
      NamedPermission.CREATE_PROJECT_MEMBER_NOT_OWN,
      NamedPermission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER,
      NamedPermission.DELETE_PROJECT_MEMBER_TOPCODER,
      NamedPermission.DELETE_PROJECT_MEMBER_CUSTOMER,
      NamedPermission.DELETE_PROJECT_MEMBER_COPILOT,
      NamedPermission.CREATE_PROJECT_INVITE_CUSTOMER,
      NamedPermission.CREATE_PROJECT_INVITE_TOPCODER,
      NamedPermission.UPDATE_PROJECT_INVITE_NOT_OWN,
      NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER,
      NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER,
      NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT,
      NamedPermission.MANAGE_PROJECT_BILLING_ACCOUNT_ID,
      NamedPermission.MANAGE_PROJECT_DIRECT_PROJECT_ID,
      NamedPermission.VIEW_PROJECT_ATTACHMENT,
      NamedPermission.CREATE_PROJECT_ATTACHMENT,
      NamedPermission.EDIT_PROJECT_ATTACHMENT,
      NamedPermission.DELETE_PROJECT_ATTACHMENT,
      NamedPermission.ADD_PROJECT_PHASE,
      NamedPermission.UPDATE_PROJECT_PHASE,
      NamedPermission.DELETE_PROJECT_PHASE,
      NamedPermission.ADD_PHASE_PRODUCT,
      NamedPermission.UPDATE_PHASE_PRODUCT,
      NamedPermission.DELETE_PHASE_PRODUCT,
      NamedPermission.WORKSTREAM_CREATE,
      NamedPermission.WORKSTREAM_VIEW,
      NamedPermission.WORKSTREAM_EDIT,
      NamedPermission.WORKSTREAM_DELETE,
      NamedPermission.WORK_CREATE,
      NamedPermission.WORK_VIEW,
      NamedPermission.WORK_EDIT,
      NamedPermission.WORK_DELETE,
      NamedPermission.WORKITEM_CREATE,
      NamedPermission.WORKITEM_VIEW,
      NamedPermission.WORKITEM_EDIT,
      NamedPermission.WORKITEM_DELETE,
    ].includes(permission);
  }

  isNamedPermissionRequireProjectInvites(permission: NamedPermission): boolean {
    return permission === NamedPermission.VIEW_PROJECT;
  }

  getDefaultProjectRole(user: JwtUser): ProjectMemberRole | undefined {
    for (const rule of DEFAULT_PROJECT_ROLE) {
      if (this.hasPermission({ topcoderRoles: [rule.topcoderRole] }, user)) {
        return rule.projectRole;
      }
    }

    return undefined;
  }

  normalizeRole(role: string): string {
    return String(role).trim().toLowerCase();
  }

  hasIntersection(array1: string[], array2: string[]): boolean {
    const normalizedArray1 = new Set(
      array1.map((role) => this.normalizeRole(role)),
    );
    return array2.some((role) =>
      normalizedArray1.has(this.normalizeRole(role)),
    );
  }

  private getProjectMember(
    userId: string | number | undefined,
    projectMembers: ProjectMember[],
  ): ProjectMember | undefined {
    if (!userId) {
      return undefined;
    }

    const normalizedUserId = this.normalizeUserId(userId);

    return projectMembers.find(
      (member) => this.normalizeUserId(member.userId) === normalizedUserId,
    );
  }

  private normalizeUserId(
    userId: string | number | bigint | undefined,
  ): string {
    return String(userId || '').trim();
  }

  private matchProjectRoleRule(
    member: ProjectMember,
    rule: ProjectRoleRule,
  ): boolean {
    const roleMatches =
      this.normalizeRole(member.role) === this.normalizeRole(rule.role);

    if (!roleMatches) {
      return false;
    }

    if (typeof rule.isPrimary === 'boolean') {
      return Boolean(member.isPrimary) === rule.isPrimary;
    }

    return true;
  }

  private isCopilot(role?: string): boolean {
    if (!role) {
      return false;
    }

    return (
      this.normalizeRole(role) === this.normalizeRole(ProjectMemberRole.COPILOT)
    );
  }

  private isCustomer(role?: string): boolean {
    if (!role) {
      return false;
    }

    return (
      this.normalizeRole(role) ===
      this.normalizeRole(ProjectMemberRole.CUSTOMER)
    );
  }

  private hasCopilotManagerRole(user: JwtUser): boolean {
    return this.hasIntersection(user.roles || [], [UserRole.COPILOT_MANAGER]);
  }
}
