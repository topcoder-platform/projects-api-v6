export enum ProjectMemberRole {
  MANAGER = 'manager',
  CUSTOMER = 'customer',
  COPILOT = 'copilot',
  OBSERVER = 'observer',
  ACCOUNT_MANAGER = 'account_manager',
  PROJECT_MANAGER = 'project_manager',
  PROGRAM_MANAGER = 'program_manager',
  SOLUTION_ARCHITECT = 'solution_architect',
  ACCOUNT_EXECUTIVE = 'account_executive',
}

export const PROJECT_MEMBER_MANAGER_ROLES: ProjectMemberRole[] = [
  ProjectMemberRole.MANAGER,
  ProjectMemberRole.ACCOUNT_MANAGER,
  ProjectMemberRole.ACCOUNT_EXECUTIVE,
  ProjectMemberRole.PROJECT_MANAGER,
  ProjectMemberRole.PROGRAM_MANAGER,
  ProjectMemberRole.SOLUTION_ARCHITECT,
];

export const PROJECT_MEMBER_NON_CUSTOMER_ROLES: ProjectMemberRole[] = [
  ProjectMemberRole.MANAGER,
  ProjectMemberRole.COPILOT,
  ProjectMemberRole.ACCOUNT_MANAGER,
  ProjectMemberRole.ACCOUNT_EXECUTIVE,
  ProjectMemberRole.PROJECT_MANAGER,
  ProjectMemberRole.PROGRAM_MANAGER,
  ProjectMemberRole.SOLUTION_ARCHITECT,
];
