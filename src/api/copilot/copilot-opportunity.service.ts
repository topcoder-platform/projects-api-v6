import {
  BadRequestException,
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
  ensureNamedPermission,
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
/**
 * Manages copilot opportunity visibility, assignment, and cancellation.
 * listOpportunities and getOpportunity are intentionally open to authenticated users
 * so copilots can browse opportunities and apply.
 */
export class CopilotOpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly notificationService: CopilotNotificationService,
  ) {}

  /**
   * Lists opportunities with pagination and status-priority grouping.
   * Uses a two-phase fetch: opportunities first, then membership lookup to compute canApplyAsCopilot.
   * Default ordering groups by status priority active -> canceled -> completed unless noGrouping is true.
   * Admin/manager responses also include minimal project metadata for v5 compatibility.
   *
   * @param query Pagination, sort, and noGrouping parameters.
   * @param user Authenticated JWT user, or undefined for anonymous `@Public()` callers.
   * @returns Paginated opportunity response payload.
   */
  async listOpportunities(
    query: ListOpportunitiesQueryDto,
    user: JwtUser | undefined,
  ): Promise<PaginatedOpportunityResponse> {
    // TODO [SECURITY]: No permission check is applied here; this is intentional for authenticated browsing and should remain explicitly documented.
    const [sortField, sortDirection] = parseSortExpression(
      query.sort,
      OPPORTUNITY_SORTS,
      'createdAt desc',
    );

    const includeProject = isAdminOrManager(user);

    // TODO [PERF]: This fetches the full opportunity set and performs sorting/pagination in memory; move to DB-level orderBy/skip/take for scale.
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

  /**
   * Returns a single opportunity with eligibility context.
   * canApplyAsCopilot is true when the user is not already a member of the project.
   * Admin/manager responses also include minimal project metadata for v5 compatibility.
   *
   * @param opportunityId Opportunity id path value.
   * @param user Authenticated JWT user, or undefined for anonymous `@Public()` callers.
   * @returns One formatted opportunity response.
   * @throws BadRequestException If id is non-numeric.
   * @throws NotFoundException If opportunity does not exist.
   */
  async getOpportunity(
    opportunityId: string,
    user: JwtUser | undefined,
  ): Promise<CopilotOpportunityResponseDto> {
    // TODO [SECURITY]: No permission check is applied; any authenticated user can access any opportunity by id.
    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const includeProject = isAdminOrManager(user);

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
      user?.userId && user.userId.trim().length > 0
        ? !members.includes(user.userId)
        : true;

    return this.formatOpportunity(
      opportunity,
      canApplyAsCopilot,
      members,
      includeProject,
    );
  }

  /**
   * Assigns a selected copilot application to an active opportunity in one transaction:
   * 1) validate active opportunity with project
   * 2) validate application belongs to opportunity
   * 3) guard against double-accept
   * 4) upsert project member with copilot role
   * 5) accept selected application
   * 6) cancel other applications
   * 7) mark opportunity completed
   * 8) mark linked request fulfilled
   *
   * @param opportunityId Opportunity id path value.
   * @param dto Assignment payload with applicationId.
   * @param user Authenticated JWT user.
   * @returns Assigned application id payload.
   * @throws ForbiddenException If user lacks ASSIGN_COPILOT_OPPORTUNITY permission.
   * @throws NotFoundException If opportunity is not found.
   * @throws BadRequestException If ids are invalid, opportunity is inactive, or application is invalid/already accepted.
   */
  async assignCopilot(
    opportunityId: string,
    dto: AssignCopilotDto,
    user: JwtUser,
  ): Promise<{ id: string }> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.ASSIGN_COPILOT_OPPORTUNITY,
      user,
    );

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
          // TODO [SECURITY]: Existing non-copilot/non-manager roles (for example customer) are silently upgraded to copilot without explicit confirmation or dedicated audit event.
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

  /**
   * Cancels an opportunity and its applications in a transaction, then sends notifications.
   *
   * @param opportunityId Opportunity id path value.
   * @param user Authenticated JWT user.
   * @returns Canceled opportunity id payload.
   * @throws ForbiddenException If user lacks CANCEL_COPILOT_OPPORTUNITY permission.
   * @throws NotFoundException If opportunity is not found.
   * @throws BadRequestException If id is non-numeric.
   */
  async cancelOpportunity(
    opportunityId: string,
    user: JwtUser,
  ): Promise<{ id: string }> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.CANCEL_COPILOT_OPPORTUNITY,
      user,
    );

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

  /**
   * Formats an opportunity response DTO.
   * Request data fields are spread directly onto the response.
   *
   * @param input Opportunity row with relations.
   * @param canApplyAsCopilot Whether caller can apply.
   * @param members Optional member userId list.
   * @param includeProjectDetails Whether to include admin/manager project metadata.
   * @returns Formatted opportunity response.
   */
  private formatOpportunity(
    input: OpportunityWithRelations,
    canApplyAsCopilot: boolean,
    members: string[] | undefined,
    includeProjectDetails: boolean,
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

    const projectId =
      normalized.projectId !== undefined && normalized.projectId !== null
        ? String(normalized.projectId)
        : normalized.project?.id !== undefined &&
            normalized.project?.id !== null
          ? String(normalized.project.id)
          : undefined;

    if (includeProjectDetails && projectId) {
      response.projectId = projectId;
    }

    if (
      includeProjectDetails &&
      projectId &&
      typeof normalized.project?.name === 'string'
    ) {
      response.project = {
        name: normalized.project.name,
      };
    }

    return response;
  }

  /**
   * Sorts opportunities by status-priority grouping (unless noGrouping) and createdAt.
   *
   * @param rows Opportunity rows.
   * @param sortField Sort field.
   * @param sortDirection Sort direction.
   * @param noGrouping When true, skip status-priority grouping.
   * @returns Sorted opportunities.
   */
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

  /**
   * Resolves project ids where the current user is already a member.
   * Returns early for missing/non-numeric user ids and performs one batch membership query.
   *
   * @param opportunities Opportunity rows used to collect project ids.
   * @param user Authenticated JWT user.
   * @returns Set of project ids where membership exists.
   */
  private async getMembershipProjectIds(
    opportunities: CopilotOpportunity[],
    user: JwtUser | undefined,
  ): Promise<Set<string>> {
    if (!user?.userId || !/^\d+$/.test(user.userId)) {
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
}
