import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CopilotOpportunity,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
  CopilotRequest,
  CopilotRequestStatus,
  Prisma,
} from '@prisma/client';
import { Permission as NamedPermission } from 'src/shared/constants/permissions';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { CopilotNotificationService } from './copilot-notification.service';
import {
  CopilotRequestListQueryDto,
  CopilotRequestResponseDto,
  CreateCopilotRequestDto,
  UpdateCopilotRequestDto,
} from './dto/copilot-request.dto';
import {
  ensureNamedPermission,
  getAuditUserId,
  getCopilotRequestData,
  isAdminOrManager,
  normalizeEntity,
  parseNumericId,
  parseSortExpression,
  readString,
} from './copilot.utils';

const REQUEST_SORTS = [
  'createdAt asc',
  'createdAt desc',
  'projectName asc',
  'projectName desc',
  'opportunityTitle asc',
  'opportunityTitle desc',
  'projectType asc',
  'projectType desc',
  'status asc',
  'status desc',
];

type CopilotRequestWithRelations = CopilotRequest & {
  opportunities: CopilotOpportunity[];
  project?: ({ name?: string } & Record<string, unknown>) | null;
};

interface PaginatedRequestResponse {
  data: CopilotRequestResponseDto[];
  page: number;
  perPage: number;
  total: number;
}

@Injectable()
/**
 * Manages the full lifecycle of copilot requests:
 * create (with auto-approval), list, update, and manual approval.
 * Request creation atomically creates the request and invokes
 * approveRequestInternal within the same transaction.
 */
export class CopilotRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly notificationService: CopilotNotificationService,
  ) {}

  /**
   * Lists copilot requests with optional project scoping and pagination.
   *
   * @param projectId Optional project id path value used to scope requests.
   * @param query Pagination and sort parameters.
   * @param user Authenticated JWT user.
   * @returns Paginated request response payload.
   * @throws ForbiddenException If user lacks MANAGE_COPILOT_REQUEST permission.
   * @throws BadRequestException If projectId is non-numeric.
   */
  async listRequests(
    projectId: string | undefined,
    query: CopilotRequestListQueryDto,
    user: JwtUser,
  ): Promise<PaginatedRequestResponse> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.MANAGE_COPILOT_REQUEST,
      user,
    );
    const includeProjectInResponse = isAdminOrManager(user);

    const parsedProjectId = projectId
      ? parseNumericId(projectId, 'Project')
      : undefined;

    const [sortField, sortDirection] = parseSortExpression(
      query.sort,
      REQUEST_SORTS,
      'createdAt desc',
    );

    const includeProjectForSort = sortField.toLowerCase() === 'projectname';

    // TODO [PERF]: This fetches all rows and applies sort/pagination in memory; move to database-level orderBy/skip/take for large datasets.
    const requests = await this.prisma.copilotRequest.findMany({
      where: {
        deletedAt: null,
        ...(parsedProjectId ? { projectId: parsedProjectId } : {}),
      },
      include: {
        opportunities: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
        project: includeProjectInResponse
          ? true
          : includeProjectForSort
            ? {
                select: {
                  id: true,
                  name: true,
                },
              }
            : false,
      },
    });

    const sorted = this.sortRequests(requests, sortField, sortDirection);

    const page = query.page || 1;
    const perPage = query.pageSize || 20;
    const total = sorted.length;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      data: sorted
        .slice(start, end)
        .map((request) =>
          this.formatRequest(request, includeProjectInResponse),
        ),
      page,
      perPage,
      total,
    };
  }

  /**
   * Returns a single copilot request by id.
   *
   * @param copilotRequestId Copilot request id path value.
   * @param user Authenticated JWT user.
   * @returns One formatted copilot request response.
   * @throws ForbiddenException If user lacks MANAGE_COPILOT_REQUEST permission.
   * @throws BadRequestException If id is non-numeric.
   * @throws NotFoundException If the request does not exist.
   */
  async getRequest(
    copilotRequestId: string,
    user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.MANAGE_COPILOT_REQUEST,
      user,
    );

    const parsedRequestId = parseNumericId(copilotRequestId, 'Copilot request');

    const request = await this.prisma.copilotRequest.findFirst({
      where: {
        id: parsedRequestId,
        deletedAt: null,
      },
      include: {
        opportunities: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        `Copilot request with id ${copilotRequestId} was not found.`,
      );
    }

    return this.formatRequest(request, isAdminOrManager(user));
  }

  /**
   * Creates a new request and auto-approves it in one transaction.
   * Transaction flow: create request -> approveRequestInternal -> re-fetch with opportunities.
   *
   * @param projectId Project id path value.
   * @param dto Create request payload.
   * @param user Authenticated JWT user.
   * @returns Newly created and formatted request response.
   * @throws ForbiddenException If user lacks MANAGE_COPILOT_REQUEST permission.
   * @throws BadRequestException If payload data.projectId mismatches path projectId.
   * @throws ConflictException If an active request already exists for the same projectType.
   * @throws NotFoundException If project is not found.
   */
  async createRequest(
    projectId: string,
    dto: CreateCopilotRequestDto,
    user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.MANAGE_COPILOT_REQUEST,
      user,
    );

    const parsedProjectId = parseNumericId(projectId, 'Project');
    const auditUserId = getAuditUserId(user);
    // TODO [QUALITY]: projectId is parsed twice (parseNumericId to bigint and Number.parseInt to number); consolidate to a single parse source.
    const payloadData = {
      ...dto.data,
      projectId: Number.parseInt(projectId, 10),
    };

    if (
      dto.data.projectId &&
      Number.parseInt(projectId, 10) !== Number(dto.data.projectId)
    ) {
      throw new BadRequestException(
        'Payload data.projectId must match the project id in the path.',
      );
    }

    await this.ensureProjectExists(parsedProjectId);

    await this.ensureNoDuplicateRequestType(
      parsedProjectId,
      String(payloadData.projectType),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const request = await tx.copilotRequest.create({
        data: {
          projectId: parsedProjectId,
          status: CopilotRequestStatus.new,
          data: payloadData as unknown as Prisma.JsonObject,
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      const opportunity = await this.approveRequestInternal(
        tx,
        parsedProjectId,
        request.id,
        String(payloadData.projectType),
        auditUserId,
      );

      const createdRequest = await tx.copilotRequest.findFirst({
        where: {
          id: request.id,
          deletedAt: null,
        },
        include: {
          opportunities: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              id: 'asc',
            },
          },
        },
      });

      return {
        opportunity,
        request: createdRequest,
      };
    });

    if (!created.request) {
      throw new NotFoundException('Unable to create copilot request.');
    }

    await this.notificationService.sendOpportunityPostedNotification(
      created.opportunity,
      created.request,
    );

    return this.formatRequest(created.request, isAdminOrManager(user));
  }

  /**
   * Updates an existing request.
   * Canceled and fulfilled requests are immutable.
   * If projectType changes, linked opportunities are updated via updateMany.
   *
   * @param copilotRequestId Copilot request id path value.
   * @param dto Patch payload.
   * @param user Authenticated JWT user.
   * @returns Updated formatted request response.
   * @throws ForbiddenException If user lacks MANAGE_COPILOT_REQUEST permission.
   * @throws BadRequestException If id is non-numeric or request is in terminal status.
   * @throws NotFoundException If request is not found.
   * @throws ConflictException If updated projectType conflicts with an existing active request type.
   */
  async updateRequest(
    copilotRequestId: string,
    dto: UpdateCopilotRequestDto,
    user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.MANAGE_COPILOT_REQUEST,
      user,
    );

    const parsedRequestId = parseNumericId(copilotRequestId, 'Copilot request');
    const auditUserId = getAuditUserId(user);

    const request = await this.prisma.copilotRequest.findFirst({
      where: {
        id: parsedRequestId,
        deletedAt: null,
      },
      include: {
        opportunities: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        `Copilot request with id ${copilotRequestId} was not found.`,
      );
    }

    if (
      request.status === CopilotRequestStatus.canceled ||
      request.status === CopilotRequestStatus.fulfilled
    ) {
      throw new BadRequestException(
        `Copilot request with status ${request.status} cannot be updated.`,
      );
    }

    const currentData = getCopilotRequestData(request.data);
    const patchData = { ...(dto.data || {}) };

    if (
      patchData.projectType &&
      patchData.projectType !== currentData.projectType &&
      request.projectId
    ) {
      await this.ensureNoDuplicateRequestType(
        request.projectId,
        String(patchData.projectType),
        request.id,
      );
    }

    const mergedData = {
      ...currentData,
      ...patchData,
      projectId: request.projectId ? Number(request.projectId) : undefined,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.copilotRequest.update({
        where: {
          id: request.id,
        },
        data: {
          data: mergedData as unknown as Prisma.JsonObject,
          updatedBy: auditUserId,
        },
        include: {
          opportunities: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      if (patchData.projectType) {
        await tx.copilotOpportunity.updateMany({
          where: {
            copilotRequestId: request.id,
            deletedAt: null,
          },
          data: {
            type: patchData.projectType,
            updatedBy: auditUserId,
          },
        });
      }

      return updatedRequest;
    });

    return this.formatRequest(updated, isAdminOrManager(user));
  }

  /**
   * Public approval entry point that wraps approveRequestInternal in a transaction.
   *
   * @param projectId Project id path value.
   * @param copilotRequestId Copilot request id path value.
   * @param type Optional type override.
   * @param user Authenticated JWT user.
   * @returns Normalized CopilotOpportunity payload.
   * @throws ForbiddenException If user lacks MANAGE_COPILOT_REQUEST permission.
   * @throws BadRequestException If ids or type are invalid.
   * @throws NotFoundException If project or request are not found.
   * @throws ConflictException If an active opportunity of the same type already exists.
   */
  async approveRequest(
    projectId: string,
    copilotRequestId: string,
    type: string | undefined,
    user: JwtUser,
  ): Promise<unknown> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.MANAGE_COPILOT_REQUEST,
      user,
    );

    const parsedProjectId = parseNumericId(projectId, 'Project');
    const parsedRequestId = parseNumericId(copilotRequestId, 'Copilot request');
    const auditUserId = getAuditUserId(user);

    const opportunity = await this.prisma.$transaction(async (tx) =>
      this.approveRequestInternal(
        tx,
        parsedProjectId,
        parsedRequestId,
        type,
        auditUserId,
      ),
    );

    const request = opportunity.copilotRequestId
      ? await this.prisma.copilotRequest.findFirst({
          where: {
            id: opportunity.copilotRequestId,
            deletedAt: null,
          },
        })
      : null;

    await this.notificationService.sendOpportunityPostedNotification(
      opportunity,
      request,
    );

    return normalizeEntity(opportunity);
  }

  /**
   * Core request approval workflow.
   * Validates project and request, validates type enum, checks for active opportunity conflicts,
   * marks request approved, and creates an active opportunity.
   *
   * @param tx Prisma transaction client.
   * @param projectId Parsed project id.
   * @param copilotRequestId Parsed request id.
   * @param type Optional type override.
   * @param auditUserId Numeric audit user id.
   * @returns Created CopilotOpportunity row.
   * @throws NotFoundException If project or request are missing.
   * @throws BadRequestException If type is invalid.
   * @throws ConflictException If active opportunity of same type already exists.
   */
  private async approveRequestInternal(
    tx: Prisma.TransactionClient,
    projectId: bigint,
    copilotRequestId: bigint,
    type: string | undefined,
    auditUserId: number,
  ): Promise<CopilotOpportunity> {
    await this.ensureProjectExists(projectId, tx);

    const request = await tx.copilotRequest.findFirst({
      where: {
        id: copilotRequestId,
        deletedAt: null,
      },
    });

    if (!request) {
      throw new NotFoundException(
        `Copilot request with id ${copilotRequestId.toString()} was not found.`,
      );
    }

    const requestData = getCopilotRequestData(request.data);
    const requestedType = (
      readString(type) ||
      readString(requestData.projectType) ||
      ''
    ).trim();

    if (
      !Object.values(CopilotOpportunityType).includes(
        requestedType as CopilotOpportunityType,
      )
    ) {
      throw new BadRequestException('Invalid copilot opportunity type.');
    }

    const existingOpportunity = await tx.copilotOpportunity.findFirst({
      where: {
        projectId,
        type: requestedType as CopilotOpportunityType,
        status: CopilotOpportunityStatus.active,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingOpportunity) {
      throw new ConflictException(
        "There's an active opportunity of same type already!",
      );
    }

    await tx.copilotRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: CopilotRequestStatus.approved,
        updatedBy: auditUserId,
      },
    });

    return tx.copilotOpportunity.create({
      data: {
        projectId,
        copilotRequestId: request.id,
        status: CopilotOpportunityStatus.active,
        type: requestedType as CopilotOpportunityType,
        createdBy: auditUserId,
        updatedBy: auditUserId,
      },
    });
  }

  /**
   * Ensures a project exists by id.
   *
   * @param projectId Project id.
   * @param tx Optional Prisma transaction client; falls back to this.prisma when omitted.
   * @returns Resolves when project exists.
   * @throws NotFoundException If project does not exist.
   */
  private async ensureProjectExists(
    projectId: bigint,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;

    const project = await client.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId.toString()} was not found.`,
      );
    }
  }

  /**
   * Ensures there is no active request with the same projectType for a project.
   *
   * @param projectId Project id.
   * @param projectType Requested project type.
   * @param excludeRequestId Optional request id to exclude (used by update flow).
   * @returns Resolves when no duplicate exists.
   * @throws ConflictException If duplicate request type exists.
   */
  private async ensureNoDuplicateRequestType(
    projectId: bigint,
    projectType: string,
    excludeRequestId?: bigint,
  ): Promise<void> {
    const duplicate = await this.prisma.copilotRequest.findFirst({
      where: {
        projectId,
        deletedAt: null,
        status: {
          in: [
            CopilotRequestStatus.new,
            CopilotRequestStatus.approved,
            CopilotRequestStatus.seeking,
          ],
        },
        ...(excludeRequestId
          ? {
              id: {
                not: excludeRequestId,
              },
            }
          : {}),
        data: {
          path: ['projectType'],
          equals: projectType,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      throw new ConflictException("There's a request of same type already!");
    }
  }

  /**
   * Formats a request row into API response shape.
   * projectId and project are included only for admin/manager users.
   *
   * @param input Request row with relations.
   * @param includeProjectInResponse Whether project fields should be included.
   * @returns Formatted request response DTO.
   */
  private formatRequest(
    input: CopilotRequestWithRelations,
    includeProjectInResponse: boolean,
  ): CopilotRequestResponseDto {
    const normalized = normalizeEntity(input) as Record<string, any>;

    const opportunities = Array.isArray(normalized.opportunities)
      ? normalized.opportunities.map((opportunity: Record<string, any>) => ({
          id: String(opportunity.id),
          status: opportunity.status,
          type: opportunity.type,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
        }))
      : [];

    const response: CopilotRequestResponseDto = {
      id: String(normalized.id),
      status: normalized.status,
      data: getCopilotRequestData(normalized.data as Prisma.JsonValue),
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      createdBy: String(normalized.createdBy),
      updatedBy: String(normalized.updatedBy),
      copilotOpportunity: opportunities,
    };

    if (includeProjectInResponse && normalized.projectId) {
      response.projectId = String(normalized.projectId);
    }

    if (includeProjectInResponse && normalized.project) {
      response.project = normalized.project as Record<string, unknown>;
    }

    return response;
  }

  /**
   * Sorts request rows in memory by requested field/direction.
   *
   * @param rows Request rows.
   * @param field Sort field.
   * @param direction Sort direction.
   * @returns Sorted request rows.
   */
  private sortRequests(
    rows: CopilotRequestWithRelations[],
    field: string,
    direction: 'asc' | 'desc',
  ): CopilotRequestWithRelations[] {
    // TODO [PERF]: In-memory sort should be replaced with DB orderBy when listRequests moves to DB pagination.
    const factor = direction === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftData = getCopilotRequestData(left.data);
      const rightData = getCopilotRequestData(right.data);

      if (field === 'projectName') {
        return (
          this.compareValues(
            left.project?.name as unknown,
            right.project?.name as unknown,
          ) * factor
        );
      }

      if (field === 'opportunityTitle') {
        return (
          this.compareValues(
            leftData.opportunityTitle,
            rightData.opportunityTitle,
          ) * factor
        );
      }

      if (field === 'projectType') {
        return (
          this.compareValues(leftData.projectType, rightData.projectType) *
          factor
        );
      }

      if (field === 'status') {
        return this.compareValues(left.status, right.status) * factor;
      }

      return this.compareValues(left.createdAt, right.createdAt) * factor;
    });
  }

  /**
   * Compares two values for sorting.
   * Uses a Date fast-path, then falls back to case-insensitive string comparison.
   *
   * @param left Left value.
   * @param right Right value.
   * @returns Comparison result (-1, 0, 1).
   */
  private compareValues(left: unknown, right: unknown): number {
    if (left instanceof Date && right instanceof Date) {
      return left.getTime() - right.getTime();
    }

    const leftValue = readString(left)?.toLowerCase() || '';
    const rightValue = readString(right)?.toLowerCase() || '';

    if (leftValue < rightValue) {
      return -1;
    }

    if (leftValue > rightValue) {
      return 1;
    }

    return 0;
  }
}
