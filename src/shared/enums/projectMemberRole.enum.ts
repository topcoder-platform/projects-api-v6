/**
 * Canonical project-member role registry.
 */
export enum ProjectMemberRole {
  /**
   * Delivery manager role for project operations and governance.
   */
  MANAGER = 'manager',
  /**
   * Customer stakeholder role.
   */
  CUSTOMER = 'customer',
  /**
   * Copilot delivery specialist role.
   */
  COPILOT = 'copilot',
  /**
   * Read-only observer role.
   */
  OBSERVER = 'observer',
  /**
   * Account manager role.
   */
  ACCOUNT_MANAGER = 'account_manager',
  /**
   * Project manager role.
   */
  PROJECT_MANAGER = 'project_manager',
  /**
   * Program manager role.
   */
  PROGRAM_MANAGER = 'program_manager',
  /**
   * Solution architect role.
   */
  SOLUTION_ARCHITECT = 'solution_architect',
  /**
   * Account executive role.
   */
  ACCOUNT_EXECUTIVE = 'account_executive',
}

/**
 * Management-tier project member roles used by query filters and permissions.
 */
export const PROJECT_MEMBER_MANAGER_ROLES: ProjectMemberRole[] = [
  ProjectMemberRole.MANAGER,
  ProjectMemberRole.ACCOUNT_MANAGER,
  ProjectMemberRole.ACCOUNT_EXECUTIVE,
  ProjectMemberRole.PROJECT_MANAGER,
  ProjectMemberRole.PROGRAM_MANAGER,
  ProjectMemberRole.SOLUTION_ARCHITECT,
];

/**
 * Project roles considered non-customer in permission checks.
 */
export const PROJECT_MEMBER_NON_CUSTOMER_ROLES: ProjectMemberRole[] = [
  ProjectMemberRole.MANAGER,
  ProjectMemberRole.COPILOT,
  ProjectMemberRole.ACCOUNT_MANAGER,
  ProjectMemberRole.ACCOUNT_EXECUTIVE,
  ProjectMemberRole.PROJECT_MANAGER,
  ProjectMemberRole.PROGRAM_MANAGER,
  ProjectMemberRole.SOLUTION_ARCHITECT,
];
