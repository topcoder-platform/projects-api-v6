export enum UserRole {
  TOPCODER_ADMIN = 'administrator',
  MANAGER = 'Connect Manager',
  TOPCODER_ACCOUNT_MANAGER = 'Connect Account Manager',
  COPILOT = 'Connect Copilot',
  CONNECT_ADMIN = 'Connect Admin',
  COPILOT_MANAGER = 'Connect Copilot Manager',
  BUSINESS_DEVELOPMENT_REPRESENTATIVE = 'Business Development Representative',
  PRESALES = 'Presales',
  ACCOUNT_EXECUTIVE = 'Account Executive',
  PROGRAM_MANAGER = 'Program Manager',
  SOLUTION_ARCHITECT = 'Solution Architect',
  PROJECT_MANAGER = 'Project Manager',
  TASK_MANAGER = 'Task Manager',
  TOPCODER_TASK_MANAGER = 'Topcoder Task Manager',
  TALENT_MANAGER = 'Talent Manager',
  TOPCODER_TALENT_MANAGER = 'Topcoder Talent Manager',
  TOPCODER_USER = 'Topcoder User',
  TG_ADMIN = 'tgadmin',
  TC_COPILOT = 'copilot',
}

export const ADMIN_ROLES: UserRole[] = [
  UserRole.CONNECT_ADMIN,
  UserRole.TOPCODER_ADMIN,
  UserRole.TG_ADMIN,
];

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
