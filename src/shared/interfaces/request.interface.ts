/**
 * Augmented Express request type used by authenticated API handlers.
 *
 * `TokenRolesGuard` populates `user`, while `ProjectContextInterceptor` and
 * project-aware guards populate `projectContext`.
 */
import { Request } from 'express';
import { JwtUser } from '../modules/global/jwt.service';
import { ProjectContext } from './permission.interface';

/**
 * Request shape available to guards, interceptors, and controllers.
 */
export type AuthenticatedRequest = Request & {
  /**
   * Validated JWT user context set by auth guards.
   */
  user?: JwtUser;
  /**
   * Per-request project context cache set by interceptor/guards.
   */
  projectContext?: ProjectContext;
};
