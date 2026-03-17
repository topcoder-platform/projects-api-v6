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

/**
 * Central authorization engine for Projects API permissions.
 *
 * Evaluates both rule-based permission objects and named permissions against a
 * {@link JwtUser}, optional project members, and optional project invites.
 *
 * This service is injected broadly across controllers and services. The
 * `ProjectContextInterceptor` preloads project members/invites so those arrays
 * are available when permission checks run.
 */
@Injectable()
export class PermissionService {
  constructor(private readonly m2mService: M2MService) {}

  /**
   * Matches a single permission rule against user/project context.
   *
   * The rule is considered matched when any one dimension matches:
   * project role OR Topcoder role OR M2M scope.
   *
   * @param permissionRule rule to evaluate
   * @param user authenticated JWT user context
   * @param projectMembers optional members for project-role checks
   * @returns `true` when at least one rule dimension matches
   */
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

    const machineContext = this.resolveMachineContext(user);

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
        machineContext.scopes,
        permissionRule.scopes,
      );
    }

    return hasProjectRole || hasTopcoderRole || hasScope;
  }

  /**
   * Evaluates a permission object using allow/deny semantics.
   *
   * Effective result is `allowRule` minus `denyRule`.
   *
   * @param permission permission object or shorthand rule
   * @param user authenticated JWT user context
   * @param projectMembers optional members for project-role checks
   * @returns `true` when allow matches and deny does not match
   */
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

  /**
   * Evaluates one of the named permissions used by guards/controllers.
   *
   * Contains an explicit switch with all named permission intents for project,
   * member, invite, billing, copilot, attachment, and work-management actions.
   *
   * @param permission named permission enum value
   * @param user authenticated JWT user context
   * @param projectMembers project member list required by many permission paths
   * @param projectInvites invite list required by invite-aware permissions
   * @returns `true` when the user satisfies the named permission rule
   * @security `CREATE_PROJECT` currently trusts a permissive `isAuthenticated`
   * check: any non-empty `userId`, any role, any scope, or `isMachine`.
   * @security Admin detection currently includes the raw role string
   * `'topcoder_manager'`, which can drift from enum-backed role names.
   */
  hasNamedPermission(
    permission: NamedPermission,
    user: JwtUser,
    projectMembers: ProjectMember[] = [],
    projectInvites: ProjectInvite[] = [],
  ): boolean {
    if (!user) {
      return false;
    }

    const machineContext = this.resolveMachineContext(user);
    const effectiveScopes = machineContext.scopes;
    const isAuthenticated =
      Boolean(user.userId && String(user.userId).trim().length > 0) ||
      (Array.isArray(user.roles) && user.roles.length > 0) ||
      effectiveScopes.length > 0 ||
      machineContext.isMachine;
    // TODO: intentionally permissive authentication gate for CREATE_PROJECT; reassess whether any role/scope/machine token should qualify.

    // TODO: replace 'topcoder_manager' string literal with UserRole enum value.
    const isAdmin = this.hasIntersection(user.roles || [], [
      ...ADMIN_ROLES,
      UserRole.MANAGER,
      'topcoder_manager',
    ]);
    const hasStrictAdminAccess =
      this.hasIntersection(user.roles || [], ADMIN_ROLES) ||
      this.m2mService.hasRequiredScopes(effectiveScopes, [
        Scope.CONNECT_PROJECT_ADMIN,
      ]);
    const hasProjectReadScope = this.m2mService.hasRequiredScopes(
      effectiveScopes,
      [
        Scope.CONNECT_PROJECT_ADMIN,
        Scope.PROJECTS_ALL,
        Scope.PROJECTS_READ,
        Scope.PROJECTS_WRITE,
      ],
    );
    const hasProjectWriteScope = this.m2mService.hasRequiredScopes(
      effectiveScopes,
      [Scope.CONNECT_PROJECT_ADMIN, Scope.PROJECTS_ALL, Scope.PROJECTS_WRITE],
    );
    const hasMachineProjectWriteScope = Boolean(
      machineContext.isMachine && hasProjectWriteScope,
    );
    const hasProjectMemberReadScope = this.m2mService.hasRequiredScopes(
      effectiveScopes,
      [
        Scope.CONNECT_PROJECT_ADMIN,
        Scope.PROJECT_MEMBERS_ALL,
        Scope.PROJECT_MEMBERS_READ,
      ],
    );
    const hasProjectMemberWriteScope = this.m2mService.hasRequiredScopes(
      effectiveScopes,
      [
        Scope.CONNECT_PROJECT_ADMIN,
        Scope.PROJECT_MEMBERS_ALL,
        Scope.PROJECT_MEMBERS_WRITE,
      ],
    );
    const hasProjectInviteReadScope = this.m2mService.hasRequiredScopes(
      effectiveScopes,
      [
        Scope.CONNECT_PROJECT_ADMIN,
        Scope.PROJECT_INVITES_ALL,
        Scope.PROJECT_INVITES_READ,
      ],
    );
    const hasProjectInviteWriteScope = this.m2mService.hasRequiredScopes(
      effectiveScopes,
      [
        Scope.CONNECT_PROJECT_ADMIN,
        Scope.PROJECT_INVITES_ALL,
        Scope.PROJECT_INVITES_WRITE,
      ],
    );

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

      if (
        invite.userId &&
        this.normalizeUserId(invite.userId) ===
          this.normalizeUserId(user.userId)
      ) {
        return true;
      }

      const inviteEmail = this.normalizeEmail(invite.email);
      const userEmail = this.getUserEmail(user);

      return Boolean(inviteEmail && userEmail && inviteEmail === userEmail);
    });

    // TODO: extract to private isAdminManagerOrCopilot() helper to reduce duplication.
    switch (permission) {
      // Project read/write lifecycle permissions.
      case NamedPermission.READ_PROJECT_ANY:
        return isAdmin;

      case NamedPermission.VIEW_PROJECT:
        return (
          isAdmin ||
          hasProjectMembership ||
          hasPendingInvite ||
          hasProjectReadScope
        );

      case NamedPermission.CREATE_PROJECT:
        return isAuthenticated;

      case NamedPermission.EDIT_PROJECT:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasProjectUpdateTopcoderRole(user) ||
          hasMachineProjectWriteScope
        );

      case NamedPermission.DELETE_PROJECT:
        return (
          isAdmin ||
          hasMachineProjectWriteScope ||
          Boolean(
            member &&
            this.normalizeRole(member.role) ===
              this.normalizeRole(ProjectMemberRole.MANAGER),
          )
        );

      // Project member management permissions.
      case NamedPermission.READ_PROJECT_MEMBER:
        return isAdmin || hasProjectMembership || hasProjectMemberReadScope;

      case NamedPermission.CREATE_PROJECT_MEMBER_OWN:
        return isAuthenticated;

      case NamedPermission.CREATE_PROJECT_MEMBER_NOT_OWN:
      case NamedPermission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER:
      case NamedPermission.DELETE_PROJECT_MEMBER_TOPCODER:
        return isAdmin || isManagementMember || hasProjectMemberWriteScope;

      case NamedPermission.DELETE_PROJECT_MEMBER_CUSTOMER:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          hasProjectMemberWriteScope
        );

      case NamedPermission.DELETE_PROJECT_MEMBER_COPILOT:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasCopilotManagerRole(user) ||
          hasProjectMemberWriteScope
        );

      // Project invite read/write permissions.
      case NamedPermission.READ_PROJECT_INVITE_OWN:
        return isAuthenticated;

      case NamedPermission.READ_PROJECT_INVITE_NOT_OWN:
        return isAdmin || hasProjectMembership || hasProjectInviteReadScope;

      case NamedPermission.CREATE_PROJECT_INVITE_TOPCODER:
        return isAdmin || isManagementMember || hasProjectInviteWriteScope;

      case NamedPermission.CREATE_PROJECT_INVITE_CUSTOMER:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          hasProjectInviteWriteScope
        );

      case NamedPermission.CREATE_PROJECT_INVITE_COPILOT:
        return (
          isAdmin ||
          this.hasCopilotManagerRole(user) ||
          hasProjectInviteWriteScope
        );

      case NamedPermission.UPDATE_PROJECT_INVITE_OWN:
      case NamedPermission.DELETE_PROJECT_INVITE_OWN:
        return isAuthenticated;

      case NamedPermission.UPDATE_PROJECT_INVITE_REQUESTED:
      case NamedPermission.DELETE_PROJECT_INVITE_REQUESTED:
        return (
          isAdmin ||
          isManagementMember ||
          this.hasCopilotManagerRole(user) ||
          hasProjectInviteWriteScope
        );

      case NamedPermission.UPDATE_PROJECT_INVITE_NOT_OWN:
      case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER:
        return isAdmin || isManagementMember || hasProjectInviteWriteScope;

      case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          hasProjectInviteWriteScope
        );

      case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT:
        return (
          isAdmin ||
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasCopilotManagerRole(user) ||
          hasProjectInviteWriteScope
        );

      // Billing-account related permissions.
      case NamedPermission.MANAGE_PROJECT_BILLING_ACCOUNT_ID:
        return isAdmin || this.hasTalentManagerRole(user);

      case NamedPermission.MANAGE_PROJECT_DIRECT_PROJECT_ID:
        return isAdmin;

      case NamedPermission.READ_AVL_PROJECT_BILLING_ACCOUNTS:
        return (
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasProjectBillingTopcoderRole(user) ||
          this.m2mService.hasRequiredScopes(effectiveScopes, [
            Scope.CONNECT_PROJECT_ADMIN,
            Scope.PROJECTS_READ_USER_BILLING_ACCOUNTS,
          ])
        );

      case NamedPermission.READ_PROJECT_BILLING_ACCOUNT_DETAILS:
        return (
          isManagementMember ||
          this.isCopilot(member?.role) ||
          this.hasProjectBillingTopcoderRole(user) ||
          this.m2mService.hasRequiredScopes(effectiveScopes, [
            Scope.PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS,
          ])
        );

      // Copilot opportunity permissions.
      case NamedPermission.MANAGE_COPILOT_REQUEST:
      case NamedPermission.ASSIGN_COPILOT_OPPORTUNITY:
      case NamedPermission.CANCEL_COPILOT_OPPORTUNITY:
        return (
          this.hasIntersection(user.roles || [], [
            UserRole.TOPCODER_ADMIN,
            UserRole.PROJECT_MANAGER,
          ]) || hasMachineProjectWriteScope
        );

      case NamedPermission.APPLY_COPILOT_OPPORTUNITY:
        return this.hasIntersection(user.roles || [], [UserRole.TC_COPILOT]);

      case NamedPermission.CREATE_PROJECT_AS_MANAGER:
        return this.hasIntersection(user.roles || [], [
          ...ADMIN_ROLES,
          UserRole.TALENT_MANAGER,
          UserRole.TOPCODER_TALENT_MANAGER,
        ]);

      // Project attachment permissions.
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

      // Phase/work/workstream permissions.
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

      // Work manager permission matrix endpoints.
      case NamedPermission.WORK_MANAGEMENT_PERMISSION_VIEW:
        return isAuthenticated;

      case NamedPermission.WORK_MANAGEMENT_PERMISSION_EDIT:
        return hasStrictAdminAccess;

      default:
        return false;
    }
  }

  /**
   * Checks whether a rule-based permission needs project members in context.
   *
   * @param permission permission object or shorthand rule
   * @returns `true` when allow or deny rule references project roles
   */
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

  /**
   * Checks whether a named permission needs project members in context.
   *
   * This list is a static allowlist and must stay aligned with
   * {@link hasNamedPermission}.
   *
   * @param permission named permission enum value
   * @returns `true` when project member context is required
   */
  isNamedPermissionRequireProjectMembers(permission: NamedPermission): boolean {
    // TODO: derive this list programmatically or add a unit test to enforce sync.
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
      NamedPermission.READ_AVL_PROJECT_BILLING_ACCOUNTS,
      NamedPermission.READ_PROJECT_BILLING_ACCOUNT_DETAILS,
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

  /**
   * Checks whether a named permission needs project invites in context.
   *
   * @param permission named permission enum value
   * @returns `true` for invite-aware permissions (currently `VIEW_PROJECT`)
   */
  isNamedPermissionRequireProjectInvites(permission: NamedPermission): boolean {
    return permission === NamedPermission.VIEW_PROJECT;
  }

  /**
   * Resolves the default project role from Topcoder roles by precedence.
   *
   * @param user authenticated JWT user context
   * @returns first matched default {@link ProjectMemberRole}, or `undefined`
   */
  getDefaultProjectRole(user: JwtUser): ProjectMemberRole | undefined {
    // TODO: duplicated with src/shared/utils/member.utils.ts#getDefaultProjectRole; consolidate shared role-resolution logic.
    for (const rule of DEFAULT_PROJECT_ROLE) {
      if (this.hasPermission({ topcoderRoles: [rule.topcoderRole] }, user)) {
        return rule.projectRole;
      }
    }

    return undefined;
  }

  /**
   * Normalizes a role value into lowercase-trimmed form.
   *
   * @param role role string to normalize
   * @returns normalized lowercase role
   */
  normalizeRole(role: string): string {
    // TODO: duplicated with src/shared/utils/member.utils.ts#normalizeRole; extract shared normalization utility.
    // TODO: consider making these protected/private.
    return String(role).trim().toLowerCase();
  }

  /**
   * Checks whether two role arrays intersect (case-insensitive).
   *
   * @param array1 source roles
   * @param array2 roles to match against
   * @returns `true` when at least one normalized role intersects
   */
  hasIntersection(array1: string[], array2: string[]): boolean {
    // TODO: consider making these protected/private.
    const normalizedArray1 = new Set(
      array1.map((role) => this.normalizeRole(role)),
    );
    return array2.some((role) =>
      normalizedArray1.has(this.normalizeRole(role)),
    );
  }

  /**
   * Resolves machine-token status and effective scopes from the normalized user
   * and the raw token payload so guard and permission checks stay aligned.
   *
   * @param user authenticated JWT user context
   * @returns machine classification and the scopes to evaluate
   */
  private resolveMachineContext(user: JwtUser): {
    isMachine: boolean;
    scopes: string[];
  } {
    const payloadMachineContext = this.m2mService.validateMachineToken(
      user.tokenPayload,
    );

    return {
      isMachine: Boolean(user.isMachine || payloadMachineContext.isMachine),
      scopes:
        Array.isArray(user.scopes) && user.scopes.length > 0
          ? user.scopes
          : payloadMachineContext.scopes,
    };
  }

  /**
   * Finds a project member record for the given user id.
   *
   * @param userId user id from JWT or invite context
   * @param projectMembers project members loaded for the current project
   * @returns member record when found
   */
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

  /**
   * Normalizes a user id into a trimmed string.
   *
   * @param userId user id from JWT/member/invite payloads
   * @returns trimmed string user id
   */
  private normalizeUserId(
    userId: string | number | bigint | undefined,
  ): string {
    // TODO: duplicated with src/shared/utils/member.utils.ts#normalizeUserId; extract shared normalization utility.
    return String(userId || '').trim();
  }

  /**
   * Reads normalized user email from parsed claims.
   *
   * Uses `JwtUser.email` first, then falls back to suffix-based lookup in
   * `tokenPayload` for compatibility with namespaced claims.
   *
   * @param user authenticated JWT user
   * @returns lower-cased email or `undefined`
   */
  private getUserEmail(user: JwtUser): string | undefined {
    const directEmail = this.normalizeEmail(user.email);

    if (directEmail) {
      return directEmail;
    }

    const payload = user.tokenPayload;

    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    for (const key of Object.keys(payload)) {
      if (!key.toLowerCase().endsWith('email')) {
        continue;
      }

      const value = (payload as Record<string, unknown>)[key];
      if (typeof value !== 'string') {
        continue;
      }

      const normalizedEmail = this.normalizeEmail(value);

      if (normalizedEmail) {
        return normalizedEmail;
      }
    }

    return undefined;
  }

  /**
   * Normalizes email values for case-insensitive comparisons.
   *
   * @param value raw email value
   * @returns lower-cased trimmed email or `undefined`
   */
  private normalizeEmail(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedEmail = value.trim().toLowerCase();

    return normalizedEmail.length > 0 ? normalizedEmail : undefined;
  }

  /**
   * Evaluates a project-role rule against a specific member.
   *
   * @param member project member under evaluation
   * @param rule role rule including optional `isPrimary` requirement
   * @returns `true` when role (and optional primary flag) match
   */
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

  /**
   * Checks whether a project role is copilot.
   *
   * @param role project role to test
   * @returns `true` when role resolves to `COPILOT`
   */
  private isCopilot(role?: string): boolean {
    if (!role) {
      return false;
    }

    return (
      this.normalizeRole(role) === this.normalizeRole(ProjectMemberRole.COPILOT)
    );
  }

  /**
   * Checks whether a project role is customer.
   *
   * @param role project role to test
   * @returns `true` when role resolves to `CUSTOMER`
   */
  private isCustomer(role?: string): boolean {
    if (!role) {
      return false;
    }

    return (
      this.normalizeRole(role) ===
      this.normalizeRole(ProjectMemberRole.CUSTOMER)
    );
  }

  /**
   * Checks whether user has the copilot-manager Topcoder role.
   *
   * @param user authenticated JWT user context
   * @returns `true` when user has `COPILOT_MANAGER`
   */
  private hasCopilotManagerRole(user: JwtUser): boolean {
    return this.hasIntersection(user.roles || [], [UserRole.COPILOT_MANAGER]);
  }

  /**
   * Checks Topcoder roles allowed to view billing-account data.
   *
   * @param user authenticated JWT user context
   * @returns `true` when user has one of billing-related roles
   */
  private hasProjectBillingTopcoderRole(user: JwtUser): boolean {
    return this.hasIntersection(user.roles || [], [
      ...ADMIN_ROLES,
      UserRole.PROJECT_MANAGER,
      UserRole.TASK_MANAGER,
      UserRole.TOPCODER_TASK_MANAGER,
      UserRole.TALENT_MANAGER,
      UserRole.TOPCODER_TALENT_MANAGER,
    ]);
  }

  /**
   * Checks whether user has one of the Talent Manager Topcoder roles.
   *
   * @param user authenticated JWT user context
   * @returns `true` when user has Talent Manager access
   */
  private hasTalentManagerRole(user: JwtUser): boolean {
    return this.hasIntersection(user.roles || [], [
      UserRole.TALENT_MANAGER,
      UserRole.TOPCODER_TALENT_MANAGER,
    ]);
  }

  /**
   * Checks Topcoder roles allowed to edit projects.
   *
   * @param user authenticated JWT user context
   * @returns `true` when user has one of project-edit roles
   */
  private hasProjectUpdateTopcoderRole(user: JwtUser): boolean {
    return this.hasIntersection(user.roles || [], [
      UserRole.TALENT_MANAGER,
      UserRole.TOPCODER_TALENT_MANAGER,
      UserRole.PROJECT_MANAGER,
    ]);
  }
}
