import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Timeline, TimelineReference } from '@prisma/client';
import { PrismaService } from 'src/shared/modules/global/prisma.service';

export interface ResolvedTimelineProjectContext {
  timeline?: Pick<Timeline, 'id' | 'reference' | 'referenceId'>;
  reference: TimelineReference;
  referenceId: bigint;
  projectId: bigint;
}

@Injectable()
export class TimelineReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveProjectContextByTimelineId(
    timelineId: bigint,
  ): Promise<ResolvedTimelineProjectContext> {
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        id: timelineId,
        deletedAt: null,
      },
      select: {
        id: true,
        reference: true,
        referenceId: true,
      },
    });

    if (!timeline) {
      throw new NotFoundException(
        `Timeline not found for timeline id ${timelineId.toString()}.`,
      );
    }

    const projectId = await this.resolveProjectId(
      timeline.reference,
      timeline.referenceId,
    );

    return {
      timeline,
      reference: timeline.reference,
      referenceId: timeline.referenceId,
      projectId,
    };
  }

  async resolveProjectContextByReference(
    reference: TimelineReference,
    referenceId: bigint,
  ): Promise<ResolvedTimelineProjectContext> {
    const projectId = await this.resolveProjectId(reference, referenceId);

    return {
      reference,
      referenceId,
      projectId,
    };
  }

  parseTimelineReference(value: unknown): TimelineReference {
    const rawValue =
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
    const normalized = rawValue.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new BadRequestException('reference is required.');
    }

    if (
      !Object.values(TimelineReference).includes(
        normalized as TimelineReference,
      )
    ) {
      throw new BadRequestException(
        `reference must be one of: ${Object.values(TimelineReference).join(', ')}.`,
      );
    }

    return normalized as TimelineReference;
  }

  parsePositiveBigInt(value: unknown, fieldName: string): bigint {
    const rawValue =
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
    const normalized = rawValue.trim();

    if (!/^\d+$/.test(normalized)) {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }

    const parsed = BigInt(normalized);
    if (parsed <= BigInt(0)) {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }

    return parsed;
  }

  private async resolveProjectId(
    reference: TimelineReference,
    referenceId: bigint,
  ): Promise<bigint> {
    if (reference === TimelineReference.project) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: referenceId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        throw new BadRequestException(
          `Project not found for project id ${referenceId.toString()}.`,
        );
      }

      return project.id;
    }

    if (reference === TimelineReference.phase) {
      const phase = await this.prisma.projectPhase.findFirst({
        where: {
          id: referenceId,
          deletedAt: null,
        },
        select: {
          projectId: true,
        },
      });

      if (!phase) {
        throw new BadRequestException(
          `Phase not found for phase id ${referenceId.toString()}.`,
        );
      }

      return phase.projectId;
    }

    if (reference === TimelineReference.product) {
      const product = await this.prisma.phaseProduct.findFirst({
        where: {
          id: referenceId,
          deletedAt: null,
        },
        select: {
          projectId: true,
        },
      });

      if (!product) {
        throw new BadRequestException(
          `Product not found for product id ${referenceId.toString()}.`,
        );
      }

      return product.projectId;
    }

    const work = await this.prisma.workStream.findFirst({
      where: {
        id: referenceId,
        deletedAt: null,
      },
      select: {
        projectId: true,
      },
    });

    if (!work) {
      throw new BadRequestException(
        `Work stream not found for work id ${referenceId.toString()}.`,
      );
    }

    return work.projectId;
  }
}
