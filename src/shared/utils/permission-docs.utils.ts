/**
 * Swagger-facing permission documentation helpers.
 *
 * These utilities translate named or inline permission metadata into
 * human-readable access summaries without changing runtime authorization.
 */
import { RequiredPermission } from '../decorators/requirePermission.decorator';
import {
  ProjectMemberRole,
  PROJECT_MEMBER_MANAGER_ROLES,
} from '../enums/projectMemberRole.enum';
import { Scope } from '../enums/scopes.enum';
import { ADMIN_ROLES, UserRole } from '../enums/userRole.enum';
import {
  Permission as PermissionPolicy,
  PermissionRule,
  ProjectRoleRule,
} from '../interfaces/permission.interface';
import { Permission as NamedPermission } from '../constants/permissions';

/**
 * Structured permission summary rendered into Swagger operation descriptions.
 */
export interface PermissionDocumentationSummary {
  /**
   * Whether the permission allows any authenticated human or machine caller.
   */
  allowAnyAuthenticated: boolean;
  /**
   * Whether any existing project member satisfies the permission.
   */
  allowAnyProjectMember: boolean;
  /**
   * Whether a pending invite recipient satisfies the permission.
   */
  allowPendingInvite: boolean;
  /**
   * Human token roles that satisfy the permission.
   */
  userRoles: string[];
  /**
   * Project member roles that satisfy the permission.
   */
  projectRoles: string[];
  /**
   * Machine-token scopes that satisfy the permission.
   */
  scopes: string[];
}

const LEGACY_TOPCODER_MANAGER_ROLE = 'topcoder_manager';

const ADMIN_AND_MANAGER_ROLES = [
  ...ADMIN_ROLES,
  UserRole.MANAGER,
  LEGACY_TOPCODER_MANAGER_ROLE,
];

const STRICT_ADMIN_ACCESS_ROLES = [...ADMIN_ROLES];

const PROJECT_UPDATE_TOPCODER_ROLES = [
  ...ADMIN_AND_MANAGER_ROLES,
  UserRole.TALENT_MANAGER,
  UserRole.TOPCODER_TALENT_MANAGER,
  UserRole.PROJECT_MANAGER,
];

const PROJECT_BILLING_TOPCODER_ROLES = [
  ...ADMIN_ROLES,
  UserRole.PROJECT_MANAGER,
  UserRole.TASK_MANAGER,
  UserRole.TOPCODER_TASK_MANAGER,
  UserRole.TALENT_MANAGER,
  UserRole.TOPCODER_TALENT_MANAGER,
];

const PROJECT_MEMBER_MANAGEMENT_ROLES = [...PROJECT_MEMBER_MANAGER_ROLES];

const PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES = [
  ...PROJECT_MEMBER_MANAGER_ROLES,
  ProjectMemberRole.COPILOT,
];

const PROJECT_MEMBER_MANAGEMENT_COPILOT_AND_CUSTOMER_ROLES = [
  ...PROJECT_MEMBER_MANAGER_ROLES,
  ProjectMemberRole.COPILOT,
  ProjectMemberRole.CUSTOMER,
];

const PROJECT_READ_SCOPES = [
  Scope.CONNECT_PROJECT_ADMIN,
  Scope.PROJECTS_ALL,
  Scope.PROJECTS_READ,
  Scope.PROJECTS_WRITE,
];

const PROJECT_WRITE_SCOPES = [
  Scope.CONNECT_PROJECT_ADMIN,
  Scope.PROJECTS_ALL,
  Scope.PROJECTS_WRITE,
];

const PROJECT_MEMBER_READ_SCOPES = [
  Scope.CONNECT_PROJECT_ADMIN,
  Scope.PROJECT_MEMBERS_ALL,
  Scope.PROJECT_MEMBERS_READ,
];

const PROJECT_INVITE_READ_SCOPES = [
  Scope.CONNECT_PROJECT_ADMIN,
  Scope.PROJECT_INVITES_ALL,
  Scope.PROJECT_INVITES_READ,
];

const PROJECT_INVITE_WRITE_SCOPES = [
  Scope.CONNECT_PROJECT_ADMIN,
  Scope.PROJECT_INVITES_ALL,
  Scope.PROJECT_INVITES_WRITE,
];

const BILLING_ACCOUNT_READ_SCOPES = [
  Scope.CONNECT_PROJECT_ADMIN,
  Scope.PROJECTS_READ_USER_BILLING_ACCOUNTS,
];

const BILLING_ACCOUNT_DETAILS_SCOPES = [
  Scope.PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS,
];

const STRICT_ADMIN_SCOPES = [Scope.CONNECT_PROJECT_ADMIN];

const COPILOT_REQUEST_USER_ROLES = [
  UserRole.TOPCODER_ADMIN,
  UserRole.PROJECT_MANAGER,
];

/**
 * Builds a normalized summary with deterministic ordering.
 *
 * @param partial summary fields to normalize and deduplicate
 * @returns normalized documentation summary
 */
function createSummary(
  partial: Partial<PermissionDocumentationSummary>,
): PermissionDocumentationSummary {
  return {
    allowAnyAuthenticated: Boolean(partial.allowAnyAuthenticated),
    allowAnyProjectMember: Boolean(partial.allowAnyProjectMember),
    allowPendingInvite: Boolean(partial.allowPendingInvite),
    userRoles: dedupeStrings(partial.userRoles || []),
    projectRoles: dedupeStrings(partial.projectRoles || []),
    scopes: dedupeStrings(partial.scopes || []),
  };
}

/**
 * Deduplicates strings while preserving first-seen order.
 *
 * @param values string values to normalize
 * @returns deduplicated string array
 */
function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values.map((value) => String(value).trim()).filter((value) => value),
    ),
  );
}

/**
 * Formats a project-role rule into a display-friendly string.
 *
 * @param rule project role string or structured primary-role matcher
 * @returns role label for Swagger output
 */
function formatProjectRoleRule(rule: string | ProjectRoleRule): string {
  if (typeof rule === 'string') {
    return rule;
  }

  if (rule.isPrimary) {
    return `${rule.role} (primary only)`;
  }

  return rule.role;
}

/**
 * Extracts allow-side documentation from an inline permission rule.
 *
 * @param permission inline permission object used by `@RequirePermission`
 * @returns summary derived from allow-rule fields
 */
function getInlinePermissionDocumentation(
  permission: PermissionPolicy,
): PermissionDocumentationSummary {
  const allowRule: PermissionRule = permission.allowRule || permission;

  return createSummary({
    allowAnyAuthenticated: allowRule.topcoderRoles === true,
    userRoles: Array.isArray(allowRule.topcoderRoles)
      ? allowRule.topcoderRoles
      : [],
    allowAnyProjectMember: allowRule.projectRoles === true,
    projectRoles: Array.isArray(allowRule.projectRoles)
      ? allowRule.projectRoles.map((rule) => formatProjectRoleRule(rule))
      : [],
    scopes: allowRule.scopes || [],
  });
}

/**
 * Resolves the documentation summary for a named permission.
 *
 * The returned data mirrors the current `PermissionService.hasNamedPermission`
 * switch so Swagger reflects live authorization behavior.
 *
 * @param permission named permission enum value
 * @returns resolved summary, or `undefined` when unmapped
 */
function getNamedPermissionDocumentation(
  permission: NamedPermission,
): PermissionDocumentationSummary | undefined {
  switch (permission) {
    case NamedPermission.READ_PROJECT_ANY:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
      });

    case NamedPermission.VIEW_PROJECT:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        allowAnyProjectMember: true,
        allowPendingInvite: true,
        scopes: PROJECT_READ_SCOPES,
      });

    case NamedPermission.CREATE_PROJECT:
      return createSummary({
        allowAnyAuthenticated: true,
      });

    case NamedPermission.EDIT_PROJECT:
      return createSummary({
        userRoles: PROJECT_UPDATE_TOPCODER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
        scopes: PROJECT_WRITE_SCOPES,
      });

    case NamedPermission.DELETE_PROJECT:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: [`${ProjectMemberRole.MANAGER}`],
        scopes: PROJECT_WRITE_SCOPES,
      });

    case NamedPermission.READ_PROJECT_MEMBER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        allowAnyProjectMember: true,
        scopes: PROJECT_MEMBER_READ_SCOPES,
      });

    case NamedPermission.CREATE_PROJECT_MEMBER_OWN:
      return createSummary({
        allowAnyAuthenticated: true,
      });

    case NamedPermission.CREATE_PROJECT_MEMBER_NOT_OWN:
    case NamedPermission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER:
    case NamedPermission.DELETE_PROJECT_MEMBER_TOPCODER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_ROLES,
      });

    case NamedPermission.DELETE_PROJECT_MEMBER_CUSTOMER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
      });

    case NamedPermission.DELETE_PROJECT_MEMBER_COPILOT:
      return createSummary({
        userRoles: [...ADMIN_AND_MANAGER_ROLES, UserRole.COPILOT_MANAGER],
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
      });

    case NamedPermission.READ_PROJECT_INVITE_OWN:
      return createSummary({
        allowAnyAuthenticated: true,
      });

    case NamedPermission.READ_PROJECT_INVITE_NOT_OWN:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        allowAnyProjectMember: true,
        scopes: PROJECT_INVITE_READ_SCOPES,
      });

    case NamedPermission.CREATE_PROJECT_INVITE_TOPCODER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_ROLES,
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.CREATE_PROJECT_INVITE_CUSTOMER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.CREATE_PROJECT_INVITE_COPILOT:
      return createSummary({
        userRoles: [...ADMIN_AND_MANAGER_ROLES, UserRole.COPILOT_MANAGER],
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.UPDATE_PROJECT_INVITE_OWN:
    case NamedPermission.DELETE_PROJECT_INVITE_OWN:
      return createSummary({
        allowAnyAuthenticated: true,
      });

    case NamedPermission.UPDATE_PROJECT_INVITE_REQUESTED:
    case NamedPermission.DELETE_PROJECT_INVITE_REQUESTED:
      return createSummary({
        userRoles: [...ADMIN_AND_MANAGER_ROLES, UserRole.COPILOT_MANAGER],
        projectRoles: PROJECT_MEMBER_MANAGEMENT_ROLES,
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.UPDATE_PROJECT_INVITE_NOT_OWN:
    case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_ROLES,
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT:
      return createSummary({
        userRoles: [...ADMIN_AND_MANAGER_ROLES, UserRole.COPILOT_MANAGER],
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
        scopes: PROJECT_INVITE_WRITE_SCOPES,
      });

    case NamedPermission.MANAGE_PROJECT_BILLING_ACCOUNT_ID:
    case NamedPermission.MANAGE_PROJECT_DIRECT_PROJECT_ID:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
      });

    case NamedPermission.READ_AVL_PROJECT_BILLING_ACCOUNTS:
      return createSummary({
        userRoles: PROJECT_BILLING_TOPCODER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
        scopes: BILLING_ACCOUNT_READ_SCOPES,
      });

    case NamedPermission.READ_PROJECT_BILLING_ACCOUNT_DETAILS:
      return createSummary({
        userRoles: PROJECT_BILLING_TOPCODER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
        scopes: BILLING_ACCOUNT_DETAILS_SCOPES,
      });

    case NamedPermission.MANAGE_COPILOT_REQUEST:
    case NamedPermission.ASSIGN_COPILOT_OPPORTUNITY:
    case NamedPermission.CANCEL_COPILOT_OPPORTUNITY:
      return createSummary({
        userRoles: COPILOT_REQUEST_USER_ROLES,
        scopes: PROJECT_WRITE_SCOPES,
      });

    case NamedPermission.APPLY_COPILOT_OPPORTUNITY:
      return createSummary({
        userRoles: [UserRole.TC_COPILOT],
      });

    case NamedPermission.CREATE_PROJECT_AS_MANAGER:
      return createSummary({
        userRoles: STRICT_ADMIN_ACCESS_ROLES,
      });

    case NamedPermission.VIEW_PROJECT_ATTACHMENT:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        allowAnyProjectMember: true,
      });

    case NamedPermission.CREATE_PROJECT_ATTACHMENT:
    case NamedPermission.EDIT_PROJECT_ATTACHMENT:
    case NamedPermission.DELETE_PROJECT_ATTACHMENT:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_COPILOT_AND_CUSTOMER_ROLES,
      });

    case NamedPermission.UPDATE_PROJECT_ATTACHMENT_NOT_OWN:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
      });

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
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_AND_COPILOT_ROLES,
      });

    case NamedPermission.WORKSTREAM_VIEW:
    case NamedPermission.WORK_VIEW:
    case NamedPermission.WORKITEM_VIEW:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        allowAnyProjectMember: true,
      });

    case NamedPermission.WORKSTREAM_DELETE:
    case NamedPermission.WORK_DELETE:
    case NamedPermission.WORKITEM_DELETE:
      return createSummary({
        userRoles: ADMIN_AND_MANAGER_ROLES,
        projectRoles: PROJECT_MEMBER_MANAGEMENT_ROLES,
      });

    case NamedPermission.WORK_MANAGEMENT_PERMISSION_VIEW:
      return createSummary({
        allowAnyAuthenticated: true,
      });

    case NamedPermission.WORK_MANAGEMENT_PERMISSION_EDIT:
      return createSummary({
        userRoles: STRICT_ADMIN_ACCESS_ROLES,
        scopes: STRICT_ADMIN_SCOPES,
      });

    default:
      return undefined;
  }
}

/**
 * Merges multiple permission summaries using route-level OR semantics.
 *
 * @param summaries per-permission summaries
 * @returns merged summary, or `undefined` when nothing resolved
 */
export function getRequiredPermissionsDocumentation(
  summaries: RequiredPermission[],
): PermissionDocumentationSummary | undefined {
  const resolvedSummaries = summaries
    .map((permission) =>
      typeof permission === 'string'
        ? getNamedPermissionDocumentation(permission)
        : getInlinePermissionDocumentation(permission),
    )
    .filter(
      (summary): summary is PermissionDocumentationSummary =>
        typeof summary !== 'undefined',
    );

  if (resolvedSummaries.length === 0) {
    return undefined;
  }

  return resolvedSummaries.reduce<PermissionDocumentationSummary>(
    (merged, summary) =>
      createSummary({
        allowAnyAuthenticated:
          merged.allowAnyAuthenticated || summary.allowAnyAuthenticated,
        allowAnyProjectMember:
          merged.allowAnyProjectMember || summary.allowAnyProjectMember,
        allowPendingInvite:
          merged.allowPendingInvite || summary.allowPendingInvite,
        userRoles: [...merged.userRoles, ...summary.userRoles],
        projectRoles: [...merged.projectRoles, ...summary.projectRoles],
        scopes: [...merged.scopes, ...summary.scopes],
      }),
    createSummary({}),
  );
}
