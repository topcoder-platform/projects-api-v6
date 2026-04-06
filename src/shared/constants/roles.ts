import { UserRole } from 'src/shared/enums/userRole.enum';

/**
 * Coarse auth pass-through for workstream/work/workitem endpoints.
 *
 * Fine-grained access is still enforced by `PermissionGuard`, which needs to
 * see all authenticated human roles so project-member and manager-tier
 * read-parity checks can run.
 */
export const WORK_LAYER_ALLOWED_ROLES = Object.values(UserRole);
