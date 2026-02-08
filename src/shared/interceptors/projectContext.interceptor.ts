import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { LoggerService } from '../modules/global/logger.service';
import { PrismaService } from '../modules/global/prisma.service';

@Injectable()
export class ProjectContextInterceptor implements NestInterceptor {
  private readonly logger = LoggerService.forRoot('ProjectContextInterceptor');

  constructor(private readonly prisma: PrismaService) {}

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
          projectId: BigInt(projectId),
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

  private extractProjectId(request: AuthenticatedRequest): string | undefined {
    const rawProjectId = request.params?.projectId;

    if (typeof rawProjectId !== 'string' || rawProjectId.trim().length === 0) {
      return undefined;
    }

    return rawProjectId.trim();
  }
}
