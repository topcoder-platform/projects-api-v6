import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from 'src/shared/interfaces/request.interface';
import {
  ResolvedTimelineProjectContext,
  TimelineReferenceService,
} from '../timeline-reference.service';

type TimelineAwareRequest = AuthenticatedRequest & {
  timelineContext?: ResolvedTimelineProjectContext;
};

@Injectable()
export class TimelineProjectContextGuard implements CanActivate {
  constructor(
    private readonly timelineReferenceService: TimelineReferenceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TimelineAwareRequest>();

    const timelineId = this.extractValue(request.params?.timelineId);
    if (timelineId) {
      const parsedTimelineId =
        this.timelineReferenceService.parsePositiveBigInt(
          timelineId,
          'timelineId',
        );

      const timelineContext =
        await this.timelineReferenceService.resolveProjectContextByTimelineId(
          parsedTimelineId,
        );

      const bodyReference = this.extractValue(request.body?.reference);
      const bodyReferenceId = this.extractValue(request.body?.referenceId);

      if (bodyReference || bodyReferenceId) {
        if (!bodyReference || !bodyReferenceId) {
          throw new BadRequestException(
            'reference and referenceId must be provided together.',
          );
        }

        const resolvedReference =
          this.timelineReferenceService.parseTimelineReference(bodyReference);
        const resolvedReferenceId =
          this.timelineReferenceService.parsePositiveBigInt(
            bodyReferenceId,
            'referenceId',
          );

        const bodyContext =
          await this.timelineReferenceService.resolveProjectContextByReference(
            resolvedReference,
            resolvedReferenceId,
          );

        this.attachProjectContext(request, {
          ...timelineContext,
          reference: bodyContext.reference,
          referenceId: bodyContext.referenceId,
          projectId: bodyContext.projectId,
        });

        return true;
      }

      this.attachProjectContext(request, timelineContext);
      return true;
    }

    const queryReference = this.extractValue(request.query?.reference);
    const queryReferenceId = this.extractValue(request.query?.referenceId);
    const bodyReference = this.extractValue(request.body?.reference);
    const bodyReferenceId = this.extractValue(request.body?.referenceId);

    const referenceSource = queryReference
      ? {
          reference: queryReference,
          referenceId: queryReferenceId,
        }
      : {
          reference: bodyReference,
          referenceId: bodyReferenceId,
        };

    if (!referenceSource.reference && !referenceSource.referenceId) {
      return true;
    }

    if (!referenceSource.reference || !referenceSource.referenceId) {
      throw new BadRequestException(
        'reference and referenceId must be provided together.',
      );
    }

    const reference = this.timelineReferenceService.parseTimelineReference(
      referenceSource.reference,
    );
    const referenceId = this.timelineReferenceService.parsePositiveBigInt(
      referenceSource.referenceId,
      'referenceId',
    );

    const resolvedContext =
      await this.timelineReferenceService.resolveProjectContextByReference(
        reference,
        referenceId,
      );

    this.attachProjectContext(request, resolvedContext);

    return true;
  }

  private attachProjectContext(
    request: TimelineAwareRequest,
    context: ResolvedTimelineProjectContext,
  ): void {
    request.timelineContext = context;

    if (!request.params) {
      request.params = {};
    }

    request.params.projectId = context.projectId.toString();
    request.params.timelineReference = context.reference;
    request.params.timelineReferenceId = context.referenceId.toString();
  }

  private extractValue(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }

    return undefined;
  }
}
