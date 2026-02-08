import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  CopilotRequestListQueryDto,
  CopilotRequestResponseDto,
  CreateCopilotRequestDto,
  UpdateCopilotRequestDto,
} from './dto/copilot-request.dto';
import {
  getAuditUserId,
  getCopilotRequestData,
  isAdminOrManager,
  normalizeEntity,
  parseNumericId,
  parseSortExpression,
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
  project?: {
    id: bigint;
    name: string;
  } | null;
};

interface PaginatedRequestResponse {
  data: CopilotRequestResponseDto[];
  page: number;
  perPage: number;
  total: number;
}

@Injectable()
export class CopilotRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async listRequests(
    projectId: string | undefined,
    query: CopilotRequestListQueryDto,
    user: JwtUser,
  ): Promise<PaginatedRequestResponse> {
    this.ensurePermission(NamedPermission.MANAGE_COPILOT_REQUEST, user);

    const parsedProjectId = projectId
      ? parseNumericId(projectId, 'Project')
      : undefined;

    const [sortField, sortDirection] = parseSortExpression(
      query.sort,
      REQUEST_SORTS,
      'createdAt desc',
    );

    const includeProject =
      isAdminOrManager(user) || sortField.toLowerCase() === 'projectname';

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

    const sorted = this.sortRequests(requests, sortField, sortDirection);

    const page = query.page || 1;
    const perPage = query.pageSize || 20;
    const total = sorted.length;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    return {
      data: sorted
        .slice(start, end)
        .map((request) => this.formatRequest(request, isAdminOrManager(user))),
      page,
      perPage,
      total,
    };
  }

  async getRequest(
    copilotRequestId: string,
    user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    this.ensurePermission(NamedPermission.MANAGE_COPILOT_REQUEST, user);

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

    return this.formatRequest(
      request as CopilotRequestWithRelations,
      isAdminOrManager(user),
    );
  }

  async createRequest(
    projectId: string,
    dto: CreateCopilotRequestDto,
    user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    this.ensurePermission(NamedPermission.MANAGE_COPILOT_REQUEST, user);

    const parsedProjectId = parseNumericId(projectId, 'Project');
    const auditUserId = getAuditUserId(user);
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

      await this.approveRequestInternal(
        tx,
        parsedProjectId,
        request.id,
        String(payloadData.projectType),
        auditUserId,
      );

      return tx.copilotRequest.findFirst({
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
    });

    if (!created) {
      throw new NotFoundException('Unable to create copilot request.');
    }

    return this.formatRequest(
      created as CopilotRequestWithRelations,
      isAdminOrManager(user),
    );
  }

  async updateRequest(
    copilotRequestId: string,
    dto: UpdateCopilotRequestDto,
    user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    this.ensurePermission(NamedPermission.MANAGE_COPILOT_REQUEST, user);

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

    return this.formatRequest(
      updated as CopilotRequestWithRelations,
      isAdminOrManager(user),
    );
  }

  async approveRequest(
    projectId: string,
    copilotRequestId: string,
    type: string | undefined,
    user: JwtUser,
  ): Promise<unknown> {
    this.ensurePermission(NamedPermission.MANAGE_COPILOT_REQUEST, user);

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

    return normalizeEntity(opportunity);
  }

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
      this.readString(type) ||
      this.readString(requestData.projectType) ||
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

  private formatRequest(
    input: CopilotRequestWithRelations,
    includeProjectId: boolean,
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

    if (includeProjectId && normalized.projectId) {
      response.projectId = String(normalized.projectId);
    }

    return response;
  }

  private sortRequests(
    rows: CopilotRequestWithRelations[],
    field: string,
    direction: 'asc' | 'desc',
  ): CopilotRequestWithRelations[] {
    const factor = direction === 'asc' ? 1 : -1;

    return [...rows].sort((left, right) => {
      const leftData = getCopilotRequestData(left.data);
      const rightData = getCopilotRequestData(right.data);

      if (field === 'projectName') {
        return (
          this.compareValues(left.project?.name, right.project?.name) * factor
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

  private compareValues(left: unknown, right: unknown): number {
    if (left instanceof Date && right instanceof Date) {
      return left.getTime() - right.getTime();
    }

    const leftValue = this.readString(left)?.toLowerCase() || '';
    const rightValue = this.readString(right)?.toLowerCase() || '';

    if (leftValue < rightValue) {
      return -1;
    }

    if (leftValue > rightValue) {
      return 1;
    }

    return 0;
  }

  private ensurePermission(permission: NamedPermission, user: JwtUser): void {
    if (!this.permissionService.hasNamedPermission(permission, user)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private readString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return `${value}`;
    }

    return undefined;
  }
}
