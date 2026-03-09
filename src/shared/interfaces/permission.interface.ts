/**
 * Shared type contracts for the permission system.
 *
 * These interfaces are consumed by permission decorators, guards, and services
 * to evaluate authorization decisions consistently.
 */
/**
 * A project-role rule used inside permission definitions.
 */
export interface ProjectRoleRule {
  /**
   * Project member role value.
   */
  role: string;
  /**
   * Whether the rule applies only to the primary member of the role.
   */
  isPrimary?: boolean;
}

/**
 * A single allow/deny rule for role and scope checks.
 */
export interface PermissionRule {
  /**
   * Topcoder roles:
   * - `string[]`: specific allowed roles.
   * - `true`: any authenticated user.
   */
  topcoderRoles?: string[] | boolean;
  /**
   * Project roles:
   * - `(string | ProjectRoleRule)[]`: specific project role checks.
   * - `true`: any project member.
   */
  projectRoles?: (string | ProjectRoleRule)[] | boolean;
  /**
   * Required M2M token scopes.
   */
  scopes?: string[];
}

/**
 * Full permission policy object.
 */
export interface Permission {
  /**
   * Allow rule evaluated by permission service.
   */
  allowRule?: PermissionRule;
  /**
   * Deny rule evaluated before or alongside allow checks.
   */
  denyRule?: PermissionRule;
  /**
   * Shorthand equivalent to `allowRule.topcoderRoles`.
   */
  topcoderRoles?: string[] | boolean;
  /**
   * Shorthand equivalent to `allowRule.projectRoles`.
   */
  projectRoles?: (string | ProjectRoleRule)[] | boolean;
  /**
   * Shorthand equivalent to `allowRule.scopes`.
   */
  scopes?: string[];
  /**
   * Documentation metadata for grouping and display.
   */
  meta?: {
    title?: string;
    group?: string;
    description?: string;
  };
}

/**
 * Project member shape used by permission checks.
 */
export interface ProjectMember {
  id?: bigint | number | string;
  projectId?: bigint | number | string;
  /**
   * Member user identifier.
   */
  userId: bigint | number | string;
  /**
   * Project member role value.
   */
  role: string;
  /**
   * Whether the member is primary for the assigned role.
   */
  isPrimary?: boolean;
  deletedAt?: Date | null;
}

/**
 * Project invite shape used by permission checks.
 */
export interface ProjectInvite {
  id?: bigint | number | string;
  projectId?: bigint | number | string;
  userId?: bigint | number | string | null;
  email?: string | null;
  status: string;
  deletedAt?: Date | null;
}

/**
 * Per-request project context cache attached to `AuthenticatedRequest`.
 */
export interface ProjectContext {
  /**
   * Currently cached project id.
   */
  projectId?: string;
  /**
   * Whether members were already loaded for the current `projectId`.
   */
  projectMembersLoaded?: boolean;
  /**
   * Cached project members for the current project id.
   */
  projectMembers: ProjectMember[];
  /**
   * Whether invites were already loaded for the current `projectId`.
   */
  projectInvitesLoaded?: boolean;
  /**
   * Cached project invites for the current project id.
   */
  projectInvites?: ProjectInvite[];
}
