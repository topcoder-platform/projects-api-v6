import { UserRole } from 'src/shared/enums/userRole.enum';

/**
 * Roles allowed for workstream/work/workitem endpoints.
 */
export const WORK_LAYER_ALLOWED_ROLES = [
  UserRole.TOPCODER_ADMIN,
  UserRole.CONNECT_ADMIN,
  UserRole.TG_ADMIN,
  UserRole.MANAGER,
  UserRole.COPILOT,
  UserRole.TC_COPILOT,
  UserRole.COPILOT_MANAGER,
] as const;
