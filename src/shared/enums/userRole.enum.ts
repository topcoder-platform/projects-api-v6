/**
 * Canonical Topcoder platform role values from JWT `roles` claim.
 */
export enum UserRole {
  /**
   * Topcoder platform administrator.
   */
  TOPCODER_ADMIN = 'administrator',
  /**
   * Connect manager role.
   */
  MANAGER = 'Connect Manager',
  /**
   * Connect account manager role.
   */
  TOPCODER_ACCOUNT_MANAGER = 'Connect Account Manager',
  /**
   * Connect copilot role.
   */
  COPILOT = 'Connect Copilot',
  /**
   * Connect admin role.
   */
  CONNECT_ADMIN = 'Connect Admin',
  /**
   * Connect copilot manager role.
   */
  COPILOT_MANAGER = 'Connect Copilot Manager',
  /**
   * Business development representative role.
   */
  BUSINESS_DEVELOPMENT_REPRESENTATIVE = 'Business Development Representative',
  /**
   * Presales role.
   */
  PRESALES = 'Presales',
  /**
   * Account executive role.
   */
  ACCOUNT_EXECUTIVE = 'Account Executive',
  /**
   * Program manager role.
   */
  PROGRAM_MANAGER = 'Program Manager',
  /**
   * Solution architect role.
   */
  SOLUTION_ARCHITECT = 'Solution Architect',
  /**
   * Project manager role.
   */
  PROJECT_MANAGER = 'Project Manager',
  /**
   * Task manager role.
   */
  TASK_MANAGER = 'Task Manager',
  /**
   * Topcoder task manager role.
   */
  TOPCODER_TASK_MANAGER = 'Topcoder Task Manager',
  /**
   * Talent manager role.
   */
  TALENT_MANAGER = 'Talent Manager',
  /**
   * Topcoder talent manager role.
   */
  TOPCODER_TALENT_MANAGER = 'Topcoder Talent Manager',
  /**
   * Generic Topcoder authenticated user role.
   */
  TOPCODER_USER = 'Topcoder User',
  /**
   * Legacy tgadmin role.
   */
  TG_ADMIN = 'tgadmin',
  /**
   * Legacy lowercase copilot role.
   */
  TC_COPILOT = 'copilot',
}

/**
 * Roles treated as platform admins.
 */
export const ADMIN_ROLES: UserRole[] = [
  UserRole.CONNECT_ADMIN,
  UserRole.TOPCODER_ADMIN,
  UserRole.TG_ADMIN,
];

/**
 * Roles treated as manager-tier access (admins included).
 *
 * @todo `MANAGER_ROLES` overlaps with `MANAGER_TOPCODER_ROLES` in
 * `src/shared/utils/member.utils.ts`. Remove the local copy and import this
 * list directly.
 */
export const MANAGER_ROLES: UserRole[] = [
  ...ADMIN_ROLES,
  UserRole.MANAGER,
  UserRole.TOPCODER_ACCOUNT_MANAGER,
  UserRole.COPILOT_MANAGER,
  UserRole.BUSINESS_DEVELOPMENT_REPRESENTATIVE,
  UserRole.PRESALES,
  UserRole.ACCOUNT_EXECUTIVE,
  UserRole.PROGRAM_MANAGER,
  UserRole.SOLUTION_ARCHITECT,
  UserRole.PROJECT_MANAGER,
];
