/**
 * Request-scoped project-context cache primer.
 *
 * This interceptor preloads project members into `request.projectContext`
 * before route handlers execute to reduce repeated database lookups.
 */
import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  internalBillingAccountIds,
  isRestrictedTalentManager,
} from '../utils/internal-project.utils';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { LoggerService } from '../modules/global/logger.service';
import { PrismaService } from '../modules/global/prisma.service';
import { parseNumericStringId } from '../utils/service.utils';

/**
 * Interceptor that enforces internal-project exclusions and caches membership context.
 */
@Injectable()
export class ProjectContextInterceptor implements NestInterceptor {
  /**
   * Static logger instance used for non-blocking preload failures.
   */
  private readonly logger = LoggerService.forRoot('ProjectContextInterceptor');

  /**
   * @param prisma Prisma client used for project member lookups.
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initializes `request.projectContext` and preloads project members when a
   * `projectId` route param is available.
   *
   * Behavior:
   * - Rejects Talent Manager access to configured internal projects before cache hits.
   * - Initializes `request.projectContext` if absent.
   * - Short-circuits when no project id is present.
   * - Short-circuits on cache hits where project id already matches.
   * - Throws `BadRequestException` when `projectId` is present but not numeric.
   * - Queries active project members and maps `role` to plain strings.
   * - On query error, logs a warning and stores `projectMembers = []`.
   *
   * @throws ForbiddenException for internal projects accessed by a Talent Manager.
   * @throws Database/configuration errors during internal-project checks propagate.
   * @todo Member query + mapping logic is duplicated in multiple guards.
   * Introduce a shared `ProjectContextService` to centralize loading behavior.
   */
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.projectContext) {
      request.projectContext = {
        projectMembers: [],
      };
    }

    const projectId = this.extractProjectId(request);

    if (!projectId) {
      return next.handle();
    }

    const parsedProjectId = parseNumericStringId(projectId, 'Project id');

    if (isRestrictedTalentManager(request.user)) {
      const internalIds = internalBillingAccountIds();
      if (internalIds.length) {
        const internalProject = await this.prisma.project.findFirst({
          where: {
            id: parsedProjectId,
            deletedAt: null,
            billingAccountId: { in: internalIds },
          },
          select: { id: true },
        });
        if (internalProject) {
          throw new ForbiddenException(
            'Talent Managers cannot access internal projects',
          );
        }
      }
    }

    if (
      request.projectContext.projectId === projectId &&
      Array.isArray(request.projectContext.projectMembers)
    ) {
      return next.handle();
    }

    request.projectContext.projectId = projectId;

    try {
      const projectMembers = await this.prisma.projectMember.findMany({
        where: {
          projectId: parsedProjectId,
          deletedAt: null,
        },
        select: {
          id: true,
          projectId: true,
          userId: true,
          role: true,
          isPrimary: true,
          deletedAt: true,
        },
      });

      request.projectContext.projectMembers = projectMembers.map((member) => ({
        ...member,
        role: String(member.role),
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to load project members for projectId=${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      request.projectContext.projectMembers = [];
    }

    return next.handle();
  }

  /**
   * Extracts a normalized `projectId` route param.
   *
   * @returns Trimmed id or `undefined` when missing/blank/non-string.
   */
  private extractProjectId(request: AuthenticatedRequest): string | undefined {
    const rawProjectId = request.params?.projectId;

    if (typeof rawProjectId !== 'string' || rawProjectId.trim().length === 0) {
      return undefined;
    }

    return rawProjectId.trim();
  }
}
