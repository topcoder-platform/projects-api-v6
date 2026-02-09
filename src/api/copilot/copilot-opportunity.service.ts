import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CopilotApplication,
  CopilotApplicationStatus,
  CopilotOpportunity,
  CopilotOpportunityStatus,
  CopilotRequest,
  CopilotRequestStatus,
  Prisma,
  ProjectMemberRole,
} from '@prisma/client';
import { Permission as NamedPermission } from 'src/shared/constants/permissions';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { CopilotNotificationService } from './copilot-notification.service';
import { AssignCopilotDto } from './dto/copilot-application.dto';
import {
  CopilotOpportunityResponseDto,
  ListOpportunitiesQueryDto,
} from './dto/copilot-opportunity.dto';
import {
  getAuditUserId,
  getCopilotRequestData,
  isAdminOrManager,
  normalizeEntity,
  parseNumericId,
  parseSortExpression,
} from './copilot.utils';

const OPPORTUNITY_SORTS = ['createdAt asc', 'createdAt desc'];

const STATUS_PRIORITY: Record<CopilotOpportunityStatus, number> = {
  [CopilotOpportunityStatus.active]: 0,
  [CopilotOpportunityStatus.canceled]: 1,
  [CopilotOpportunityStatus.completed]: 2,
};

type OpportunityWithRelations = CopilotOpportunity & {
  copilotRequest?: CopilotRequest | null;
  project?: {
    id: bigint;
    name: string;
    members?: Array<{
      userId: bigint;
    }>;
  } | null;
};

type ApplicationWithMembership = CopilotApplication & {
  existingMembership?: {
    role: string;
  };
};

interface PaginatedOpportunityResponse {
  data: CopilotOpportunityResponseDto[];
  page: number;
  perPage: number;
  total: number;
}

@Injectable()
export class CopilotOpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly notificationService: CopilotNotificationService,
  ) {}

  async listOpportunities(
    query: ListOpportunitiesQueryDto,
    user: JwtUser,
  ): Promise<PaginatedOpportunityResponse> {
    const [sortField, sortDirection] = parseSortExpression(
      query.sort,
      OPPORTUNITY_SORTS,
      'createdAt desc',
    );

    const includeProject = isAdminOrManager(user);

    const opportunities = await this.prisma.copilotOpportunity.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        copilotRequest: true,
        project: includeProject
          ? {
              select: {
                id: true,
                name: true,
              },
            }
          : false,
      },
    });

    const canApplyProjectIds = await this.getMembershipProjectIds(
      opportunities,
      user,
    );

    const sorted = this.sortOpportunities(
      opportunities as OpportunityWithRelations[],
      sortField,
      sortDirection,
      query.noGrouping,
    );

    const page = query.page || 1;
    const perPage = query.pageSize || 20;
    const total = sorted.length;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      data: sorted.slice(start, end).map((opportunity) => {
        const formatted = this.formatOpportunity(
          opportunity,
          !canApplyProjectIds.has(String(opportunity.projectId || '')),
          undefined,
          includeProject,
        );

        return formatted;
      }),
      page,
      perPage,
      total,
    };
  }

  async getOpportunity(
    opportunityId: string,
    user: JwtUser,
  ): Promise<CopilotOpportunityResponseDto> {
    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');

    const opportunity = await this.prisma.copilotOpportunity.findFirst({
      where: {
        id: parsedOpportunityId,
        deletedAt: null,
      },
      include: {
        copilotRequest: true,
        project: {
          select: {
            id: true,
            name: true,
            members: {
              where: {
                deletedAt: null,
              },
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!opportunity) {
      throw new NotFoundException(
        `Copilot opportunity with id ${opportunityId} was not found.`,
      );
    }

    const members = (opportunity.project?.members || []).map((member) =>
      member.userId.toString(),
    );

    const canApplyAsCopilot =
      user.userId && user.userId.trim().length > 0
        ? !members.includes(user.userId)
        : true;

    return this.formatOpportunity(
      opportunity,
      canApplyAsCopilot,
      members,
      isAdminOrManager(user),
    );
  }

  async assignCopilot(
    opportunityId: string,
    dto: AssignCopilotDto,
    user: JwtUser,
  ): Promise<{ id: string }> {
    this.ensurePermission(NamedPermission.ASSIGN_COPILOT_OPPORTUNITY, user);

    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const parsedApplicationId = parseNumericId(
      dto.applicationId,
      'Copilot application',
    );
    const auditUserId = getAuditUserId(user);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.copilotOpportunity.findFirst({
        where: {
          id: parsedOpportunityId,
          deletedAt: null,
        },
        include: {
          copilotRequest: true,
        },
      });

      if (!opportunity) {
        throw new NotFoundException(
          `Copilot opportunity with id ${opportunityId} was not found.`,
        );
      }

      if (opportunity.status !== CopilotOpportunityStatus.active) {
        throw new BadRequestException('Opportunity is not active.');
      }

      if (!opportunity.projectId) {
        throw new BadRequestException(
          'Opportunity does not have an associated project.',
        );
      }

      const application = await tx.copilotApplication.findFirst({
        where: {
          id: parsedApplicationId,
          opportunityId: opportunity.id,
          deletedAt: null,
        },
      });

      if (!application) {
        throw new BadRequestException('No such application available.');
      }

      if (application.status === CopilotApplicationStatus.accepted) {
        throw new BadRequestException('Application already accepted.');
      }

      const activeMembers = await tx.projectMember.findMany({
        where: {
          projectId: opportunity.projectId,
          deletedAt: null,
        },
      });

      const existingMember = activeMembers.find(
        (member) => member.userId === application.userId,
      );

      if (existingMember) {
        if (
          existingMember.role !== ProjectMemberRole.copilot &&
          existingMember.role !== ProjectMemberRole.manager
        ) {
          await tx.projectMember.update({
            where: {
              id: existingMember.id,
            },
            data: {
              role: ProjectMemberRole.copilot,
              updatedBy: auditUserId,
            },
          });
        }
      } else {
        await tx.projectMember.create({
          data: {
            projectId: opportunity.projectId,
            userId: application.userId,
            role: ProjectMemberRole.copilot,
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });
      }

      const acceptedApplication = await tx.copilotApplication.update({
        where: {
          id: application.id,
        },
        data: {
          status: CopilotApplicationStatus.accepted,
          updatedBy: auditUserId,
        },
      });

      const otherApplications = await tx.copilotApplication.findMany({
        where: {
          opportunityId: opportunity.id,
          deletedAt: null,
          id: {
            not: acceptedApplication.id,
          },
        },
      });

      if (otherApplications.length > 0) {
        await tx.copilotApplication.updateMany({
          where: {
            id: {
              in: otherApplications.map((item) => item.id),
            },
          },
          data: {
            status: CopilotApplicationStatus.canceled,
            updatedBy: auditUserId,
          },
        });
      }

      await tx.copilotOpportunity.update({
        where: {
          id: opportunity.id,
        },
        data: {
          status: CopilotOpportunityStatus.completed,
          updatedBy: auditUserId,
        },
      });

      if (opportunity.copilotRequestId) {
        await tx.copilotRequest.update({
          where: {
            id: opportunity.copilotRequestId,
          },
          data: {
            status: CopilotRequestStatus.fulfilled,
            updatedBy: auditUserId,
          },
        });
      }

      const appWithMembership: ApplicationWithMembership = {
        ...acceptedApplication,
      };

      if (existingMember) {
        appWithMembership.existingMembership = {
          role: existingMember.role,
        };
      }

      return {
        opportunity,
        acceptedApplication: appWithMembership,
        otherApplications,
        copilotRequest: opportunity.copilotRequest,
      };
    });

    await this.notificationService.sendCopilotAssignedNotification(
      assignment.opportunity,
      assignment.acceptedApplication,
      assignment.copilotRequest,
    );

    await this.notificationService.sendCopilotRejectedNotification(
      assignment.opportunity,
      assignment.otherApplications,
      assignment.copilotRequest,
    );

    return {
      id: dto.applicationId,
    };
  }

  async cancelOpportunity(
    opportunityId: string,
    user: JwtUser,
  ): Promise<{ id: string }> {
    this.ensurePermission(NamedPermission.CANCEL_COPILOT_OPPORTUNITY, user);

    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const auditUserId = getAuditUserId(user);

    const canceled = await this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.copilotOpportunity.findFirst({
        where: {
          id: parsedOpportunityId,
          deletedAt: null,
        },
        include: {
          copilotRequest: true,
        },
      });

      if (!opportunity) {
        throw new NotFoundException(
          `Copilot opportunity with id ${opportunityId} was not found.`,
        );
      }

      const applications = await tx.copilotApplication.findMany({
        where: {
          opportunityId: opportunity.id,
          deletedAt: null,
        },
      });

      if (applications.length > 0) {
        await tx.copilotApplication.updateMany({
          where: {
            id: {
              in: applications.map((application) => application.id),
            },
          },
          data: {
            status: CopilotApplicationStatus.canceled,
            updatedBy: auditUserId,
          },
        });
      }

      await tx.copilotOpportunity.update({
        where: {
          id: opportunity.id,
        },
        data: {
          status: CopilotOpportunityStatus.canceled,
          updatedBy: auditUserId,
        },
      });

      return {
        opportunity,
        applications,
      };
    });

    await this.notificationService.sendOpportunityCanceledNotification(
      canceled.opportunity,
      canceled.applications,
    );

    return {
      id: opportunityId,
    };
  }

  private formatOpportunity(
    input: OpportunityWithRelations,
    canApplyAsCopilot: boolean,
    members: string[] | undefined,
    includeProjectId: boolean,
  ): CopilotOpportunityResponseDto {
    const normalized = normalizeEntity(input) as Record<string, any>;
    const requestData = getCopilotRequestData(
      normalized.copilotRequest?.data as Prisma.JsonValue,
    );

    const response: CopilotOpportunityResponseDto = {
      id: String(normalized.id),
      copilotRequestId: normalized.copilotRequestId
        ? String(normalized.copilotRequestId)
        : undefined,
      status: normalized.status,
      type: normalized.type,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      canApplyAsCopilot,
      members,
      ...requestData,
    };

    if (includeProjectId && normalized.projectId) {
      response.projectId = String(normalized.projectId);
    }

    return response;
  }

  private sortOpportunities(
    rows: OpportunityWithRelations[],
    sortField: string,
    sortDirection: 'asc' | 'desc',
    noGrouping?: boolean,
  ): OpportunityWithRelations[] {
    const factor = sortDirection === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      if (!noGrouping) {
        const leftPriority = STATUS_PRIORITY[left.status];
        const rightPriority = STATUS_PRIORITY[right.status];

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
      }

      if (sortField === 'createdAt') {
        return (left.createdAt.getTime() - right.createdAt.getTime()) * factor;
      }

      return 0;
    });
  }

  private async getMembershipProjectIds(
    opportunities: CopilotOpportunity[],
    user: JwtUser,
  ): Promise<Set<string>> {
    if (!user.userId || !/^\d+$/.test(user.userId)) {
      return new Set<string>();
    }

    const projectIds = opportunities
      .map((opportunity) => opportunity.projectId)
      .filter((projectId): projectId is bigint => Boolean(projectId));

    if (projectIds.length === 0) {
      return new Set<string>();
    }

    const memberships = await this.prisma.projectMember.findMany({
      where: {
        userId: BigInt(user.userId),
        projectId: {
          in: projectIds,
        },
        deletedAt: null,
      },
      select: {
        projectId: true,
      },
    });

    return new Set(
      memberships.map((membership) => membership.projectId.toString()),
    );
  }

  private ensurePermission(permission: NamedPermission, user: JwtUser): void {
    if (!this.permissionService.hasNamedPermission(permission, user)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
