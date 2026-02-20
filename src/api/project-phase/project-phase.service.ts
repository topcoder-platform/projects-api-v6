import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PhaseProduct,
  Prisma,
  ProductTemplate,
  ProjectPhase,
  ProjectPhaseApproval,
  ProjectPhaseMember,
  ProjectStatus,
} from '@prisma/client';
import { CreatePhaseDto } from 'src/api/project-phase/dto/create-phase.dto';
import { PhaseListQueryDto } from 'src/api/project-phase/dto/phase-list-query.dto';
import {
  PhaseResponseDto,
  ProjectPhaseApprovalDto,
  ProjectPhaseMemberDto,
} from 'src/api/project-phase/dto/phase-response.dto';
import { UpdatePhaseDto } from 'src/api/project-phase/dto/update-phase.dto';
import { Permission } from 'src/shared/constants/permissions';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { hasAdminRole } from 'src/shared/utils/permission.utils';

// TODO [DRY]: Move to `src/shared/interfaces/project-permission-context.interface.ts`.
interface ProjectPermissionContext {
  id: bigint;
  directProjectId: bigint | null;
  billingAccountId: bigint | null;
  members: Array<{
    userId: bigint;
    role: string;
    deletedAt: Date | null;
  }>;
}

type PhaseWithRelations = ProjectPhase & {
  products?: PhaseProduct[];
  members?: ProjectPhaseMember[];
  approvals?: ProjectPhaseApproval[];
};

interface ListPhasesOptions {
  phaseIds?: bigint[];
}

const PHASE_SORT_FIELDS = ['startDate', 'endDate', 'status', 'order'] as const;
const PHASE_RESPONSE_FIELDS = [
  'id',
  'projectId',
  'name',
  'description',
  'requirements',
  'status',
  'startDate',
  'endDate',
  'duration',
  'budget',
  'spentBudget',
  'progress',
  'details',
  'order',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'products',
  'members',
  'approvals',
] as const;
const TERMINAL_PHASE_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.completed,
  ProjectStatus.cancelled,
]);

@Injectable()
/**
 * Business logic for project phases. Handles CRUD, ordered insertion/reordering
 * of phases within a project, optional product-template seeding on creation,
 * and member assignment. Used by `ProjectPhaseController` (direct phase routes)
 * and `WorkController` (workstream-scoped work routes).
 */
export class ProjectPhaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * Lists phases for a project with optional field selection, sort, member-only
   * filtering, and optional phase id whitelist support for alias controllers.
   *
   * @param projectId - Project id from the route.
   * @param query - Query DTO with `fields`, `sort`, and `memberOnly`.
   * @param user - Authenticated user.
   * @param options - Optional constraints (for example `phaseIds` whitelist).
   * @returns Phase response DTO array.
   * @throws {BadRequestException} When route ids or sort criteria are invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When the project does not exist.
   */
  async listPhases(
    projectId: string,
    query: PhaseListQueryDto,
    user: JwtUser,
    options: ListPhasesOptions = {},
  ): Promise<PhaseResponseDto[]> {
    const parsedProjectId = this.parseId(projectId, 'Project');

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(Permission.VIEW_PROJECT, user, project.members);

    const { includeProducts, includeMembers, includeApprovals } =
      this.parseFieldSelection(query.fields);

    const orderBy = this.parseSortCriteria(query.sort);

    const where: Prisma.ProjectPhaseWhereInput = {
      projectId: parsedProjectId,
      deletedAt: null,
    };

    const phaseIds = Array.isArray(options.phaseIds)
      ? [...new Set(options.phaseIds)]
      : undefined;

    if (phaseIds && phaseIds.length === 0) {
      return [];
    }

    if (phaseIds) {
      where.id = {
        in: phaseIds,
      };
    }

    const memberOnly = query.memberOnly === true;
    if (memberOnly && !this.isAdminUser(user, project.members)) {
      const userId = this.parseOptionalBigInt(user.userId);

      if (!userId) {
        return [];
      }

      where.members = {
        some: {
          userId,
          deletedAt: null,
        },
      };
    }

    const phases = await this.prisma.projectPhase.findMany({
      where,
      include: {
        products: includeProducts
          ? {
              where: {
                deletedAt: null,
              },
              orderBy: {
                id: 'asc',
              },
            }
          : false,
        members: includeMembers
          ? {
              where: {
                deletedAt: null,
              },
              orderBy: {
                id: 'asc',
              },
            }
          : false,
        approvals: includeApprovals
          ? {
              where: {
                deletedAt: null,
              },
              orderBy: {
                id: 'asc',
              },
            }
          : false,
      },
      orderBy,
    });

    return phases
      .map((phase) => this.toDto(phase as PhaseWithRelations))
      .map((phase) => this.filterFields(phase, query.fields));
  }

  /**
   * Fetches one project phase with products, members, and approvals.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param user - Authenticated user.
   * @returns Phase response DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When the phase is not found.
   */
  async getPhase(
    projectId: string,
    phaseId: string,
    user: JwtUser,
  ): Promise<PhaseResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(Permission.VIEW_PROJECT, user, project.members);

    const phase = await this.prisma.projectPhase.findFirst({
      where: {
        id: parsedPhaseId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
      include: {
        products: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
        members: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
        approvals: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!phase) {
      throw new NotFoundException(
        `Project phase not found for project id ${projectId} and phase id ${phaseId}.`,
      );
    }

    return this.toDto(phase);
  }

  /**
   * Creates a phase inside a transaction, resolves insertion order, optionally
   * seeds a phase product from a product template, and bulk-creates members.
   *
   * @param projectId - Project id from the route.
   * @param dto - Create payload.
   * @param user - Authenticated user.
   * @returns Created phase response DTO.
   * @throws {BadRequestException} When ids, date range, or template id are invalid.
   * @throws {ForbiddenException} When the caller lacks create permission.
   * @throws {NotFoundException} When the project or created phase is not found.
   */
  async createPhase(
    projectId: string,
    dto: CreatePhaseDto,
    user: JwtUser,
  ): Promise<PhaseResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.ADD_PROJECT_PHASE,
      user,
      project.members,
    );
    this.validateDateRange(dto.startDate, dto.endDate);

    const createdPhaseId = await this.prisma.$transaction(async (tx) => {
      const existingPhases = await this.getActiveProjectPhaseOrders(
        tx,
        parsedProjectId,
      );
      const orderedExistingPhaseIds = this.sortPhasesByOrder(
        existingPhases,
      ).map((phase) => phase.id);
      const resolvedOrder = this.resolveRequestedOrder(
        dto.order,
        orderedExistingPhaseIds.length + 1,
        orderedExistingPhaseIds.length + 1,
      );

      const createdPhase = await tx.projectPhase.create({
        data: {
          projectId: parsedProjectId,
          name: dto.name,
          description: dto.description || null,
          requirements: dto.requirements || null,
          status: dto.status,
          startDate: dto.startDate,
          endDate: dto.endDate,
          duration: dto.duration,
          budget: typeof dto.budget === 'number' ? dto.budget : 0,
          spentBudget:
            typeof dto.spentBudget === 'number' ? dto.spentBudget : 0,
          progress: typeof dto.progress === 'number' ? dto.progress : 0,
          details: this.toJsonInput(dto.details || {}),
          order: resolvedOrder,
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      const reorderedPhaseIds = [...orderedExistingPhaseIds];
      reorderedPhaseIds.splice(resolvedOrder - 1, 0, createdPhase.id);
      await this.reindexProjectPhases(
        tx,
        parsedProjectId,
        reorderedPhaseIds,
        auditUserId,
      );

      if (typeof dto.productTemplateId === 'number') {
        const template = await tx.productTemplate.findFirst({
          where: {
            id: BigInt(Math.trunc(dto.productTemplateId)),
            deletedAt: null,
          },
        });

        if (!template) {
          throw new BadRequestException(
            `Product template does not exist with id ${dto.productTemplateId}.`,
          );
        }

        const phaseProductDetails =
          this.buildPhaseProductDetailsFromTemplate(template);

        await tx.phaseProduct.create({
          data: {
            phaseId: createdPhase.id,
            projectId: parsedProjectId,
            templateId: template.id,
            name: template.name,
            type: template.productKey,
            directProjectId: project.directProjectId,
            billingAccountId: project.billingAccountId,
            details: this.toJsonInput(phaseProductDetails) ?? {},
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });
      }

      if (Array.isArray(dto.members) && dto.members.length > 0) {
        const distinctMembers = [
          ...new Set(dto.members.map((member) => Math.trunc(member))),
        ];

        await tx.projectPhaseMember.createMany({
          data: distinctMembers.map((memberId) => ({
            phaseId: createdPhase.id,
            userId: BigInt(memberId),
            createdBy: auditUserId,
            updatedBy: auditUserId,
          })),
          skipDuplicates: true,
        });
      }

      return createdPhase.id;
    });

    const createdPhase = await this.prisma.projectPhase.findFirst({
      where: {
        id: createdPhaseId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
      include: {
        products: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
        members: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
        approvals: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!createdPhase) {
      throw new NotFoundException(
        `Project phase not found for project id ${projectId} after creation.`,
      );
    }

    const response = this.toDto(createdPhase);

    return response;
  }

  /**
   * Updates mutable phase fields, validates date and status transitions, and
   * reorders sibling phases when order is changed.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param dto - Update payload.
   * @param user - Authenticated user.
   * @returns Updated phase response DTO.
   * @throws {BadRequestException} When ids, dates, or status transition are invalid.
   * @throws {ForbiddenException} When the caller lacks update permission.
   * @throws {NotFoundException} When the phase is not found.
   */
  async updatePhase(
    projectId: string,
    phaseId: string,
    dto: UpdatePhaseDto,
    user: JwtUser,
  ): Promise<PhaseResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.UPDATE_PROJECT_PHASE,
      user,
      project.members,
    );

    const existingPhase = await this.prisma.projectPhase.findFirst({
      where: {
        id: parsedPhaseId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!existingPhase) {
      throw new NotFoundException(
        `Project phase not found for project id ${projectId} and phase id ${phaseId}.`,
      );
    }

    const startDate = dto.startDate || existingPhase.startDate || undefined;
    const endDate = dto.endDate || existingPhase.endDate || undefined;
    this.validateDateRange(startDate, endDate);
    this.validateStatusTransition(existingPhase.status, dto.status);

    const updatedPhase = await this.prisma.$transaction(async (tx) => {
      let resolvedOrder: number | undefined;

      if (typeof dto.order === 'number') {
        const activePhases = await this.getActiveProjectPhaseOrders(
          tx,
          parsedProjectId,
        );
        const orderedPhaseIds = this.sortPhasesByOrder(activePhases).map(
          (phase) => phase.id,
        );
        const currentIndex = orderedPhaseIds.findIndex(
          (phaseIdValue) => phaseIdValue === parsedPhaseId,
        );

        if (currentIndex < 0) {
          throw new NotFoundException(
            `Project phase not found for project id ${projectId} and phase id ${phaseId}.`,
          );
        }

        const reorderedPhaseIds = orderedPhaseIds.filter(
          (phaseIdValue) => phaseIdValue !== parsedPhaseId,
        );
        resolvedOrder = this.resolveRequestedOrder(
          dto.order,
          orderedPhaseIds.length,
          currentIndex + 1,
        );
        reorderedPhaseIds.splice(resolvedOrder - 1, 0, parsedPhaseId);

        await this.reindexProjectPhases(
          tx,
          parsedProjectId,
          reorderedPhaseIds,
          auditUserId,
          parsedPhaseId,
        );
      }

      return tx.projectPhase.update({
        where: {
          id: parsedPhaseId,
        },
        data: {
          name: dto.name,
          description: dto.description,
          requirements: dto.requirements,
          status: dto.status,
          startDate: dto.startDate,
          endDate: dto.endDate,
          duration: dto.duration,
          budget: dto.budget,
          spentBudget: dto.spentBudget,
          progress: dto.progress,
          details:
            typeof dto.details === 'undefined'
              ? undefined
              : this.toJsonInput(dto.details),
          order: typeof resolvedOrder === 'number' ? resolvedOrder : undefined,
          updatedBy: auditUserId,
        },
        include: {
          products: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              id: 'asc',
            },
          },
          members: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              id: 'asc',
            },
          },
          approvals: {
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

    const response = this.toDto(updatedPhase);

    return response;
  }

  /**
   * Soft deletes a phase and reindexes remaining phase order values.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param user - Authenticated user.
   * @returns Nothing.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks delete permission.
   * @throws {NotFoundException} When the phase is not found.
   */
  async deletePhase(
    projectId: string,
    phaseId: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.DELETE_PROJECT_PHASE,
      user,
      project.members,
    );

    const existingPhase = await this.prisma.projectPhase.findFirst({
      where: {
        id: parsedPhaseId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!existingPhase) {
      throw new NotFoundException(
        `Project phase not found for project id ${projectId} and phase id ${phaseId}.`,
      );
    }

    const deletedPhase = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.projectPhase.update({
        where: {
          id: parsedPhaseId,
        },
        data: {
          deletedAt: new Date(),
          deletedBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      const remainingPhases = await this.getActiveProjectPhaseOrders(
        tx,
        parsedProjectId,
      );
      const reorderedPhaseIds = this.sortPhasesByOrder(remainingPhases).map(
        (phase) => phase.id,
      );

      await this.reindexProjectPhases(
        tx,
        parsedProjectId,
        reorderedPhaseIds,
        auditUserId,
      );

      return deleted;
    });

    void projectId;
    void phaseId;
    void user;
    void deletedPhase;
  }

  /**
   * Parses `fields` CSV and maps to relation include flags.
   *
   * @param fields - CSV list of requested fields.
   * @returns Include flags for products, members, and approvals.
   */
  private parseFieldSelection(fields?: string): {
    includeProducts: boolean;
    includeMembers: boolean;
    includeApprovals: boolean;
  } {
    if (!fields || fields.trim().length === 0) {
      return {
        includeProducts: false,
        includeMembers: false,
        includeApprovals: false,
      };
    }

    const tokens = this.parseCsv(fields);

    return {
      includeProducts: tokens.has('products') || tokens.has('all'),
      includeMembers: tokens.has('members') || tokens.has('all'),
      includeApprovals: tokens.has('approvals') || tokens.has('all'),
    };
  }

  /**
   * Validates and maps a sort expression to Prisma `orderBy`.
   *
   * @param sort - Sort expression (`field direction`).
   * @returns Prisma-compatible orderBy object.
   * @throws {BadRequestException} When sort field or direction is invalid.
   */
  // TODO [DRY]: Extract a shared `parseSortParam(sort, allowedFields)` helper to `src/shared/utils/query.utils.ts`.
  private parseSortCriteria(sort?: string): {
    [key: string]: 'asc' | 'desc';
  } {
    if (!sort || sort.trim().length === 0) {
      return {
        startDate: 'asc',
      };
    }

    const normalized = sort.trim();
    const withDirection = normalized.includes(' ')
      ? normalized
      : `${normalized} asc`;

    const [field, direction] = withDirection.split(/\s+/);

    if (!field || !direction) {
      throw new BadRequestException('Invalid sort criteria.');
    }

    if (
      !PHASE_SORT_FIELDS.includes(field as (typeof PHASE_SORT_FIELDS)[number])
    ) {
      throw new BadRequestException('Invalid sort criteria.');
    }

    const normalizedDirection = direction.toLowerCase();
    if (normalizedDirection !== 'asc' && normalizedDirection !== 'desc') {
      throw new BadRequestException('Invalid sort criteria.');
    }

    return {
      [field]: normalizedDirection,
    };
  }

  /**
   * Applies top-level response projection for legacy `/v5` `fields` behavior.
   *
   * @param phase - Full phase DTO.
   * @param fields - Requested fields CSV.
   * @returns Filtered phase DTO.
   */
  private filterFields(
    phase: PhaseResponseDto,
    fields?: string,
  ): PhaseResponseDto {
    if (!fields || fields.trim().length === 0) {
      return phase;
    }

    const requested = this.parseCsv(fields);
    requested.add('id');

    // Apply top-level projection to match legacy /v5 `fields` behavior.
    const filtered: Record<string, unknown> = {};

    for (const field of PHASE_RESPONSE_FIELDS) {
      if (!requested.has(field.toLowerCase())) {
        continue;
      }

      filtered[field] = phase[field];
    }

    return filtered as unknown as PhaseResponseDto;
  }

  /**
   * Maps a phase entity with optional relations to response DTO shape.
   *
   * @param phase - Phase entity from Prisma.
   * @returns Serialized phase DTO.
   */
  private toDto(phase: PhaseWithRelations): PhaseResponseDto {
    const response: PhaseResponseDto = {
      id: phase.id.toString(),
      projectId: phase.projectId.toString(),
      name: phase.name,
      description: phase.description,
      requirements: phase.requirements,
      status: phase.status,
      startDate: phase.startDate,
      endDate: phase.endDate,
      duration: phase.duration,
      budget: phase.budget,
      spentBudget: phase.spentBudget,
      progress: phase.progress,
      details: this.toDetailsObject(phase.details),
      order: phase.order,
      createdAt: phase.createdAt,
      updatedAt: phase.updatedAt,
      createdBy: phase.createdBy,
      updatedBy: phase.updatedBy,
    };

    if (Array.isArray(phase.products)) {
      response.products = phase.products.map((product) => ({
        id: product.id.toString(),
        phaseId: product.phaseId.toString(),
        projectId: product.projectId.toString(),
        directProjectId: product.directProjectId
          ? product.directProjectId.toString()
          : null,
        billingAccountId: product.billingAccountId
          ? product.billingAccountId.toString()
          : null,
        templateId: product.templateId.toString(),
        name: product.name,
        type: product.type,
        estimatedPrice: product.estimatedPrice,
        actualPrice: product.actualPrice,
        details: this.toDetailsObject(product.details),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        createdBy: product.createdBy,
        updatedBy: product.updatedBy,
      }));
    }

    if (Array.isArray(phase.members)) {
      response.members = phase.members.map((member) =>
        this.toPhaseMemberDto(member),
      );
    }

    if (Array.isArray(phase.approvals)) {
      response.approvals = phase.approvals.map((approval) =>
        this.toPhaseApprovalDto(approval),
      );
    }

    return response;
  }

  /**
   * Maps a phase member entity to response DTO and serializes `bigint` ids.
   *
   * @param member - Phase member entity.
   * @returns Phase member DTO.
   */
  private toPhaseMemberDto(member: ProjectPhaseMember): ProjectPhaseMemberDto {
    return {
      id: member.id.toString(),
      phaseId: member.phaseId.toString(),
      userId: member.userId.toString(),
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      createdBy: member.createdBy,
      updatedBy: member.updatedBy,
    };
  }

  /**
   * Maps a phase approval entity to response DTO and serializes `bigint` ids.
   *
   * @param approval - Phase approval entity.
   * @returns Phase approval DTO.
   */
  private toPhaseApprovalDto(
    approval: ProjectPhaseApproval,
  ): ProjectPhaseApprovalDto {
    return {
      id: approval.id.toString(),
      phaseId: approval.phaseId.toString(),
      decision: approval.decision,
      comment: approval.comment,
      startDate: approval.startDate,
      endDate: approval.endDate,
      expectedEndDate: approval.expectedEndDate,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
      createdBy: approval.createdBy,
      updatedBy: approval.updatedBy,
    };
  }

  /**
   * Validates that start date is not after end date.
   *
   * @param startDate - Candidate start date.
   * @param endDate - Candidate end date.
   * @returns Nothing.
   * @throws {BadRequestException} When `startDate` is after `endDate`.
   */
  private validateDateRange(
    startDate?: Date | null,
    endDate?: Date | null,
  ): void {
    if (!startDate || !endDate) {
      return;
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate.');
    }
  }

  /**
   * Validates phase status transitions from non-terminal states only.
   *
   * @param currentStatus - Current persisted status.
   * @param requestedStatus - Requested status update.
   * @returns Nothing.
   * @throws {BadRequestException} When transitioning out of terminal status.
   */
  private validateStatusTransition(
    currentStatus?: ProjectStatus | null,
    requestedStatus?: ProjectStatus | null,
  ): void {
    if (
      !currentStatus ||
      !requestedStatus ||
      currentStatus === requestedStatus
    ) {
      return;
    }

    if (TERMINAL_PHASE_STATUSES.has(currentStatus)) {
      throw new BadRequestException(
        `Cannot transition phase status from ${currentStatus} to ${requestedStatus}.`,
      );
    }
  }

  /**
   * Returns active phases in a project with minimal fields used for ordering.
   *
   * @param tx - Transaction client.
   * @param projectId - Project id.
   * @returns Array of phase ids and order values.
   */
  private async getActiveProjectPhaseOrders(
    tx: Prisma.TransactionClient,
    projectId: bigint,
  ): Promise<Array<{ id: bigint; order: number | null }>> {
    return tx.projectPhase.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        order: true,
      },
    });
  }

  /**
   * Stably sorts phases by `order` (nulls last), then by id.
   *
   * @param phases - Phase rows.
   * @returns Sorted phase rows.
   */
  private sortPhasesByOrder<T extends { id: bigint; order: number | null }>(
    phases: T[],
  ): T[] {
    return [...phases].sort((left, right) => {
      const leftOrder =
        typeof left.order === 'number' ? left.order : Number.MAX_SAFE_INTEGER;
      const rightOrder =
        typeof right.order === 'number' ? right.order : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      if (left.id === right.id) {
        return 0;
      }

      return left.id < right.id ? -1 : 1;
    });
  }

  /**
   * Normalizes a requested order value into the inclusive `[1, maxOrder]` range.
   *
   * @param requestedOrder - Requested order from input.
   * @param maxOrder - Max accepted order.
   * @param fallbackOrder - Fallback order when omitted.
   * @returns Normalized order.
   */
  private resolveRequestedOrder(
    requestedOrder: number | undefined,
    maxOrder: number,
    fallbackOrder: number,
  ): number {
    if (typeof requestedOrder !== 'number') {
      return fallbackOrder;
    }

    const normalizedOrder = Math.trunc(requestedOrder);
    if (normalizedOrder < 1) {
      return 1;
    }

    if (normalizedOrder > maxOrder) {
      return maxOrder;
    }

    return normalizedOrder;
  }

  /**
   * Reindexes phase order values based on the provided sorted phase id list.
   *
   * @param tx - Transaction client.
   * @param projectId - Project id.
   * @param orderedPhaseIds - Phase ids in desired order.
   * @param auditUserId - User id for audit fields.
   * @param skipPhaseId - Optional phase id to skip.
   * @returns Nothing.
   */
  // TODO [PERF/QUALITY]: Replace per-row updates with a batched `UPDATE ... CASE WHEN` or `updateMany` strategy to avoid N round-trips in the transaction.
  private async reindexProjectPhases(
    tx: Prisma.TransactionClient,
    projectId: bigint,
    orderedPhaseIds: bigint[],
    auditUserId: number,
    skipPhaseId?: bigint,
  ): Promise<void> {
    if (orderedPhaseIds.length === 0) {
      return;
    }

    const existingPhases = await tx.projectPhase.findMany({
      where: {
        projectId,
        deletedAt: null,
        id: {
          in: orderedPhaseIds,
        },
      },
      select: {
        id: true,
        order: true,
      },
    });

    const phaseOrderMap = new Map(
      existingPhases.map((phase) => [phase.id, phase.order]),
    );

    for (const [index, phaseId] of orderedPhaseIds.entries()) {
      if (typeof skipPhaseId !== 'undefined' && phaseId === skipPhaseId) {
        continue;
      }

      const resolvedOrder = index + 1;
      if (phaseOrderMap.get(phaseId) === resolvedOrder) {
        continue;
      }

      await tx.projectPhase.update({
        where: {
          id: phaseId,
        },
        data: {
          order: resolvedOrder,
          updatedBy: auditUserId,
        },
      });
    }
  }

  /**
   * Builds phase product details payload from a product template.
   *
   * @param template - Product template row.
   * @returns Details object for phase product creation.
   */
  private buildPhaseProductDetailsFromTemplate(
    template: ProductTemplate,
  ): Record<string, unknown> {
    if (
      template.template &&
      typeof template.template === 'object' &&
      !Array.isArray(template.template)
    ) {
      return template.template as Record<string, unknown>;
    }

    return {
      template: template.template ?? null,
      form: template.form ?? null,
      aliases: template.aliases,
      category: template.category,
      subCategory: template.subCategory,
      brief: template.brief,
      description: template.details,
      productKey: template.productKey,
    };
  }

  /**
   * Safely converts unknown JSON-like data into an object DTO payload.
   *
   * @param value - Candidate details value.
   * @returns Plain object, or empty object when invalid.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private toDetailsObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  /**
   * Converts an arbitrary value into Prisma JSON input semantics.
   *
   * @param value - Candidate JSON value.
   * @returns Prisma JSON input value, JsonNull, or undefined.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  /**
   * Parses comma-separated values into a normalized lowercased token set.
   *
   * @param value - CSV string.
   * @returns Set of normalized tokens.
   */
  private parseCsv(value: string): Set<string> {
    return new Set(
      value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    );
  }

  /**
   * Parses an optional string as bigint.
   *
   * @param value - Optional raw value.
   * @returns Parsed bigint or undefined.
   */
  private parseOptionalBigInt(value?: string): bigint | undefined {
    if (!value || value.trim().length === 0) {
      return undefined;
    }

    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  /**
   * Determines whether the user is effectively an admin for member filters.
   *
   * @param user - Authenticated user.
   * @param projectMembers - Active project members.
   * @returns `true` if caller has admin access.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private isAdminUser(
    user: JwtUser,
    projectMembers: Array<{
      userId: bigint;
      role: string;
      deletedAt: Date | null;
    }>,
  ): boolean {
    return (
      hasAdminRole(user) ||
      this.permissionService.hasNamedPermission(
        Permission.READ_PROJECT_ANY,
        user,
        projectMembers,
      )
    );
  }

  /**
   * Enforces named permission checks against project member context.
   *
   * @param permission - Permission to evaluate.
   * @param user - Authenticated user.
   * @param projectMembers - Active project members.
   * @returns Nothing.
   * @throws {ForbiddenException} When permission is missing.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private ensureNamedPermission(
    permission: Permission,
    user: JwtUser,
    projectMembers: Array<{
      userId: bigint;
      role: string;
      deletedAt: Date | null;
    }>,
  ): void {
    const hasPermission = this.permissionService.hasNamedPermission(
      permission,
      user,
      projectMembers,
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /**
   * Loads project metadata and active members for permission evaluation.
   *
   * @param projectId - Parsed project id.
   * @returns Permission context payload.
   * @throws {NotFoundException} When the project does not exist.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private async getProjectPermissionContext(
    projectId: bigint,
  ): Promise<ProjectPermissionContext> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        directProjectId: true,
        billingAccountId: true,
        members: {
          where: {
            deletedAt: null,
          },
          select: {
            userId: true,
            role: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    return project;
  }

  /**
   * Parses a route id into bigint and throws on invalid values.
   *
   * @param value - Raw route id value.
   * @param entityName - Entity name for error messages.
   * @returns Parsed bigint id.
   * @throws {BadRequestException} When parsing fails.
   */
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private parseId(value: string, entityName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${entityName} id is invalid.`);
    }
  }

  /**
   * Parses the authenticated user id for audit fields.
   *
   * @param user - Authenticated user.
   * @returns Numeric user id.
   */
  // TODO [SECURITY]: Returning `-1` silently when `user.userId` is invalid can corrupt audit trails; throw `UnauthorizedException` instead.
  // TODO [DRY]: Extract to `src/shared/utils/service.utils.ts` or a shared base service.
  private getAuditUserId(user: JwtUser): number {
    const userId = Number.parseInt(String(user.userId || ''), 10);

    if (Number.isNaN(userId)) {
      return -1;
    }

    return userId;
  }
}
