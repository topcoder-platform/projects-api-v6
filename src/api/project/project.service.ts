import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Project,
  ProjectAttachment,
  ProjectMember,
  ProjectMemberInvite,
  ProjectMemberRole,
  ProjectStatus,
} from '@prisma/client';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { Scope } from 'src/shared/enums/scopes.enum';
import { ADMIN_ROLES } from 'src/shared/enums/userRole.enum';
import {
  Permission as JsonPermission,
  PermissionRule as JsonPermissionRule,
} from 'src/shared/interfaces/permission.interface';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  BillingAccount,
  BillingAccountService,
} from 'src/shared/services/billingAccount.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  publishProjectEvent,
  publishRawEvent as publishRawBusEvent,
} from 'src/shared/utils/event.utils';
import {
  ParsedProjectFields,
  buildProjectIncludeClause,
  buildProjectWhereClause,
  filterAttachmentsByPermission,
  filterInvitesByPermission,
  parseFieldsParameter,
} from 'src/shared/utils/project.utils';
import { CreateProjectDto, EstimationDto } from './dto/create-project.dto';
import { ProjectListQueryDto } from './dto/project-list-query.dto';
import { ProjectWithRelationsDto } from './dto/project-response.dto';
import { UpgradeProjectDto } from './dto/upgrade-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

interface PaginatedProjectResponse {
  data: ProjectWithRelationsDto[];
  page: number;
  perPage: number;
  total: number;
}

type ProjectPolicyMap = Record<string, boolean>;

type WorkManagementPermissionRecord = {
  policy: string;
  permission: Prisma.JsonValue;
};

interface ProjectPermissionMembershipEntry {
  memberId: string;
  role: string;
  isPrimary: boolean;
}

interface ProjectMemberPermissionMatrixEntry {
  memberships: ProjectPermissionMembershipEntry[];
  topcoderRoles: string[];
  projectPermissions: ProjectPolicyMap;
  workManagementPolicies: ProjectPolicyMap;
}

export type ProjectPermissionsResponse =
  | ProjectPolicyMap
  | Record<string, ProjectMemberPermissionMatrixEntry>;

type ProjectMemberWithHandle = ProjectMember & {
  handle?: string | null;
};

type ProjectInviteWithHandle = ProjectMemberInvite & {
  handle?: string | null;
};

type ProjectWithRawRelations = Project & {
  billingAccountName?: string;
  members?: ProjectMemberWithHandle[];
  invites?: ProjectInviteWithHandle[];
  attachments?: ProjectAttachment[];
};

@Injectable()
/**
 * Core business-logic service for projects.
 *
 * Coordinates persistence via `PrismaService`, permission checks via
 * `PermissionService`, billing-account lookups via `BillingAccountService`,
 * and lifecycle event publication through `publishProjectEvent`.
 * It also enriches members/invites with Topcoder handles by querying
 * `members.member`.
 */
export class ProjectService {
  private readonly logger = LoggerService.forRoot('ProjectService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly billingAccountService: BillingAccountService,
    private readonly memberService: MemberService,
  ) {}

  /**
   * Returns a paginated project list for the caller.
   *
   * Builds query clauses from shared utilities, scopes non-admin callers to
   * their memberships, enriches member/invite handles, and hydrates billing
   * account names.
   *
   * @param criteria List filters, paging, sort, and field selection.
   * @param user Authenticated caller context.
   * @returns Paginated project response payload.
   * @throws Database/transport errors are not handled here and propagate.
   * @security Pagination hard limit is enforced via DTO validation (`perPage`
   * max 200); there is no additional database-level cap in this method.
   */
  async listProjects(
    criteria: ProjectListQueryDto,
    user: JwtUser,
  ): Promise<PaginatedProjectResponse> {
    const page = criteria.page || 1;
    const perPage = criteria.perPage || 20;
    const skip = (page - 1) * perPage;

    const isAdmin = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_ANY,
      user,
    );

    const where = buildProjectWhereClause(criteria, user, isAdmin);
    const requestedFields = this.resolveListFields(criteria.fields);
    const includeFields = this.resolveListIncludeFields(requestedFields);
    const include = buildProjectIncludeClause(includeFields);
    const orderBy = this.resolveSort(criteria.sort);

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include,
        orderBy,
        skip,
        take: perPage,
      }),
    ]);
    const projectsWithMemberHandles =
      await this.enrichProjectsWithMemberHandles(projects);
    const billingAccountNamesById = await this.getBillingAccountNamesById(
      projectsWithMemberHandles,
    );

    const data = projectsWithMemberHandles.map((project) => {
      const billingAccountId = this.toOptionalBigintString(
        project.billingAccountId,
      );
      const filteredProject = this.filterProjectRelations(
        project,
        user,
        isAdmin,
      );
      const projectWithRequestedFields = this.filterProjectFields(
        filteredProject,
        requestedFields,
      );

      return this.toDto({
        ...projectWithRequestedFields,
        billingAccountName:
          billingAccountId && billingAccountNamesById.has(billingAccountId)
            ? billingAccountNamesById.get(billingAccountId)
            : undefined,
      });
    });

    return {
      data,
      page,
      perPage,
      total,
    };
  }

  /**
   * Returns one project with optional relation fields.
   *
   * Members and invites are always loaded for permission evaluation regardless
   * of requested `fields`, then relation visibility is filtered by caller
   * permissions before response serialization.
   *
   * @param projectId Project id path parameter.
   * @param fieldsParam Optional CSV list of relation fields.
   * @param user Authenticated caller context.
   * @returns Project response DTO.
   * @throws NotFoundException When the project does not exist.
   * @throws ForbiddenException When caller lacks `VIEW_PROJECT`.
   */
  async getProject(
    projectId: string,
    fieldsParam: string | undefined,
    user: JwtUser,
  ): Promise<ProjectWithRelationsDto> {
    const parsedProjectId = this.parseProjectId(projectId);
    const fields = parseFieldsParameter(fieldsParam);
    const fieldsForPermissionCheck: ParsedProjectFields = {
      ...fields,
      project_members: true,
      project_member_invites: true,
    };

    const project = await this.prisma.project.findFirst({
      where: {
        id: parsedProjectId,
        deletedAt: null,
      },
      include: buildProjectIncludeClause(fieldsForPermissionCheck),
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const [projectWithMemberHandles] =
      await this.enrichProjectsWithMemberHandles([project]);
    const projectWithRelations = projectWithMemberHandles || project;

    const canViewProject = this.permissionService.hasNamedPermission(
      Permission.VIEW_PROJECT,
      user,
      projectWithRelations.members || [],
      (projectWithRelations.invites || []).map((invite) => ({
        ...invite,
        status: String(invite.status),
      })),
    );

    if (!canViewProject) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const isAdmin = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_ANY,
      user,
      projectWithRelations.members || [],
    );

    const filteredProject = this.filterProjectRelations(
      projectWithRelations,
      user,
      isAdmin,
    );
    const projectWithRequestedFields = this.filterProjectFields(
      filteredProject,
      fields,
    );
    const billingAccountId = this.toOptionalBigintString(
      projectWithRelations.billingAccountId,
    );
    const billingAccountNamesById = billingAccountId
      ? await this.getBillingAccountNamesById([projectWithRelations])
      : new Map<string, string>();

    return this.toDto({
      ...projectWithRequestedFields,
      billingAccountName:
        billingAccountId && billingAccountNamesById.has(billingAccountId)
          ? billingAccountNamesById.get(billingAccountId)
          : undefined,
    });
  }

  /**
   * Creates a project and all requested nested resources in one transaction.
   *
   * Writes project, members, attachments, estimations (+items), and optional
   * template-derived phases/products, then records initial project history and
   * publishes `project.created`.
   *
   * @param dto Project creation payload.
   * @param user Authenticated caller context.
   * @returns Created project payload.
   * @throws BadRequestException For invalid type/template/building-block keys.
   * @throws ConflictException When post-transaction re-fetch fails.
   * @security Caller permissions determine the primary member role
   * (`manager` vs `customer`) assigned on creation.
   * @todo Sequential `for...of` loops for estimations and template phases in
   * the transaction can be optimized with `Promise.all` for larger payloads.
   */
  async createProject(
    dto: CreateProjectDto,
    user: JwtUser,
  ): Promise<ProjectWithRelationsDto> {
    const auditUserId = this.getAuditUserId(user);
    const actorUserId = this.getActorUserId(user);

    const projectType = await this.prisma.projectType.findFirst({
      where: {
        key: dto.type,
        deletedAt: null,
      },
      select: {
        key: true,
      },
    });

    if (!projectType) {
      throw new BadRequestException(`Invalid project type: ${dto.type}`);
    }

    const parsedTemplateId =
      typeof dto.templateId === 'number' ? BigInt(dto.templateId) : undefined;

    const projectTemplate = parsedTemplateId
      ? await this.prisma.projectTemplate.findFirst({
          where: {
            id: parsedTemplateId,
            deletedAt: null,
          },
        })
      : null;

    if (parsedTemplateId && !projectTemplate) {
      throw new BadRequestException(
        `Invalid project template id: ${dto.templateId}`,
      );
    }

    const primaryRole = this.permissionService.hasNamedPermission(
      Permission.CREATE_PROJECT_AS_MANAGER,
      user,
    )
      ? ProjectMemberRole.manager
      : ProjectMemberRole.customer;

    const now = new Date();

    const createdProjectId = await this.prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          type: dto.type,
          status: dto.status || ProjectStatus.in_review,
          cancelReason:
            typeof dto.cancelReason === 'string' ? dto.cancelReason : null,
          billingAccountId:
            typeof dto.billingAccountId === 'number'
              ? BigInt(dto.billingAccountId)
              : null,
          directProjectId:
            typeof dto.directProjectId === 'number'
              ? BigInt(dto.directProjectId)
              : null,
          estimatedPrice:
            typeof dto.estimatedPrice === 'number'
              ? new Prisma.Decimal(dto.estimatedPrice)
              : null,
          actualPrice:
            typeof dto.actualPrice === 'number'
              ? new Prisma.Decimal(dto.actualPrice)
              : null,
          terms: dto.terms || [],
          groups: dto.groups || [],
          external: this.toNullableJsonInput(dto.external?.data),
          bookmarks: this.toNullableJsonInput(dto.bookmarks),
          utm: this.toNullableJsonInput(dto.utm),
          details: this.toNullableJsonInput(dto.details),
          challengeEligibility: this.toNullableJsonInput(
            dto.challengeEligibility?.data,
          ),
          templateId: parsedTemplateId || null,
          version: dto.version || 'v3',
          lastActivityAt: now,
          lastActivityUserId: actorUserId,
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      if (this.isNumericIdentifier(actorUserId)) {
        await tx.projectMember.create({
          data: {
            projectId: createdProject.id,
            userId: BigInt(actorUserId),
            role: primaryRole,
            isPrimary: true,
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });
      }

      if (Array.isArray(dto.members) && dto.members.length > 0) {
        const additionalMembers = dto.members.filter(
          (member) => String(member.userId) !== actorUserId,
        );

        if (additionalMembers.length > 0) {
          await tx.projectMember.createMany({
            data: additionalMembers.map((member) => ({
              projectId: createdProject.id,
              userId: BigInt(member.userId),
              role: member.role,
              isPrimary: Boolean(member.isPrimary),
              createdBy: auditUserId,
              updatedBy: auditUserId,
            })),
          });
        }
      }

      if (Array.isArray(dto.attachments) && dto.attachments.length > 0) {
        await tx.projectAttachment.createMany({
          data: dto.attachments.map((attachment) => ({
            projectId: createdProject.id,
            title: attachment.title || null,
            type: attachment.type,
            path: attachment.path,
            size: attachment.size,
            contentType: attachment.contentType,
            tags: attachment.tags || [],
            allowedUsers: attachment.allowedUsers || [],
            createdBy: auditUserId,
            updatedBy: auditUserId,
          })),
        });
      }

      if (Array.isArray(dto.estimation) && dto.estimation.length > 0) {
        for (const estimation of dto.estimation) {
          await this.createEstimation(
            tx,
            estimation,
            createdProject.id,
            auditUserId,
          );
        }
      }

      if (projectTemplate?.phases) {
        const templatePhases = this.extractTemplatePhases(
          projectTemplate.phases,
        );

        for (const phase of templatePhases) {
          const createdPhase = await tx.projectPhase.create({
            data: {
              projectId: createdProject.id,
              name:
                typeof phase.name === 'string' && phase.name.trim().length > 0
                  ? phase.name.trim()
                  : null,
              description:
                typeof phase.description === 'string'
                  ? phase.description
                  : null,
              status: ProjectStatus.draft,
              order:
                typeof phase.order === 'number'
                  ? Math.trunc(phase.order)
                  : null,
              details:
                this.toJsonInput(
                  phase.details && typeof phase.details === 'object'
                    ? phase.details
                    : {},
                ) || {},
              createdBy: auditUserId,
              updatedBy: auditUserId,
            },
          });

          const products = Array.isArray(phase.products) ? phase.products : [];

          if (products.length > 0) {
            await tx.phaseProduct.createMany({
              data: products.map((product: Record<string, unknown>) => ({
                phaseId: createdPhase.id,
                projectId: createdProject.id,
                directProjectId:
                  typeof product.directProjectId === 'number'
                    ? BigInt(product.directProjectId)
                    : null,
                billingAccountId:
                  typeof product.billingAccountId === 'number'
                    ? BigInt(product.billingAccountId)
                    : null,
                templateId:
                  typeof product.templateId === 'number'
                    ? BigInt(product.templateId)
                    : BigInt(0),
                name:
                  typeof product.name === 'string' ? product.name : undefined,
                type:
                  typeof product.type === 'string' ? product.type : undefined,
                estimatedPrice:
                  typeof product.estimatedPrice === 'number'
                    ? product.estimatedPrice
                    : 0,
                actualPrice:
                  typeof product.actualPrice === 'number'
                    ? product.actualPrice
                    : 0,
                details:
                  this.toJsonInput(
                    product.details && typeof product.details === 'object'
                      ? product.details
                      : {},
                  ) || {},
                createdBy: auditUserId,
                updatedBy: auditUserId,
              })),
            });
          }
        }
      }

      await tx.projectHistory.create({
        data: {
          projectId: createdProject.id,
          status: createdProject.status,
          updatedBy: auditUserId,
        },
      });

      return createdProject.id;
    });

    const createdProject = await this.prisma.project.findFirst({
      where: {
        id: createdProjectId,
        deletedAt: null,
      },
      include: buildProjectIncludeClause(
        parseFieldsParameter('members,invites,attachments'),
      ),
    });

    if (!createdProject) {
      throw new ConflictException('Failed to create project.');
    }

    const [createdProjectWithMemberHandles] =
      await this.enrichProjectsWithMemberHandles([createdProject]);
    const response = this.toDto(
      createdProjectWithMemberHandles || createdProject,
    );
    this.publishEvent(KAFKA_TOPIC.PROJECT_CREATED, response);

    return response;
  }

  /**
   * Partially updates a project with permission-aware field guards.
   *
   * Performs additional checks for `billingAccountId` and `directProjectId`,
   * supports explicit billing-account clearing, persists optional
   * `cancelReason`, appends project history when status changes, and
   * publishes `project.updated`.
   *
   * When `billingAccountId` changes, also emits
   * `project.action.billingAccount.update` with the legacy
   * tc-project-service payload contract.
   *
   * @param projectId Project id path parameter.
   * @param dto Patch payload.
   * @param user Authenticated caller context.
   * @returns Updated project payload.
   * @throws NotFoundException When the project does not exist.
   * @throws ForbiddenException When caller lacks edit-related permissions.
   */
  async updateProject(
    projectId: string,
    dto: UpdateProjectDto,
    user: JwtUser,
  ): Promise<ProjectWithRelationsDto> {
    const parsedProjectId = this.parseProjectId(projectId);
    const auditUserId = this.getAuditUserId(user);
    const actorUserId = this.getActorUserId(user);

    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: parsedProjectId,
        deletedAt: null,
      },
      include: {
        members: {
          where: {
            deletedAt: null,
          },
        },
        invites: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    if (!existingProject) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const canEdit = this.permissionService.hasNamedPermission(
      Permission.EDIT_PROJECT,
      user,
      existingProject.members,
      existingProject.invites.map((invite) => ({
        ...invite,
        status: String(invite.status),
      })),
    );

    if (!canEdit) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const requestedBillingAccountId =
      dto.clearBillingAccountId === true
        ? null
        : typeof dto.billingAccountId === 'number'
          ? String(dto.billingAccountId)
          : undefined;
    const existingBillingAccountId =
      this.toOptionalBigintString(existingProject.billingAccountId) ?? null;

    if (
      typeof requestedBillingAccountId !== 'undefined' &&
      existingBillingAccountId !== requestedBillingAccountId
    ) {
      const hasPermission = this.permissionService.hasNamedPermission(
        Permission.MANAGE_PROJECT_BILLING_ACCOUNT_ID,
        user,
        existingProject.members,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You are not allowed to update billingAccountId.',
        );
      }
    }

    if (
      typeof dto.directProjectId !== 'undefined' &&
      String(existingProject.directProjectId || '') !==
        String(dto.directProjectId)
    ) {
      const hasPermission = this.permissionService.hasNamedPermission(
        Permission.MANAGE_PROJECT_DIRECT_PROJECT_ID,
        user,
        existingProject.members,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'You are not allowed to update directProjectId.',
        );
      }
    }

    const statusChanged =
      typeof dto.status !== 'undefined' &&
      dto.status !== existingProject.status;
    const updatedProject = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: {
          id: parsedProjectId,
        },
        data: {
          name: dto.name,
          description: dto.description,
          type: dto.type,
          status: dto.status,
          cancelReason:
            typeof dto.cancelReason === 'string' ? dto.cancelReason : undefined,
          billingAccountId:
            dto.clearBillingAccountId === true
              ? null
              : typeof dto.billingAccountId === 'number'
                ? BigInt(dto.billingAccountId)
                : undefined,
          directProjectId:
            typeof dto.directProjectId === 'number'
              ? BigInt(dto.directProjectId)
              : undefined,
          estimatedPrice:
            typeof dto.estimatedPrice === 'number'
              ? new Prisma.Decimal(dto.estimatedPrice)
              : undefined,
          actualPrice:
            typeof dto.actualPrice === 'number'
              ? new Prisma.Decimal(dto.actualPrice)
              : undefined,
          terms: dto.terms,
          groups: dto.groups,
          external:
            typeof dto.external !== 'undefined'
              ? this.toNullableJsonInput(dto.external?.data ?? null)
              : undefined,
          bookmarks:
            typeof dto.bookmarks !== 'undefined'
              ? this.toNullableJsonInput(dto.bookmarks ?? null)
              : undefined,
          utm:
            typeof dto.utm !== 'undefined'
              ? this.toNullableJsonInput(dto.utm ?? null)
              : undefined,
          details:
            typeof dto.details !== 'undefined'
              ? this.toNullableJsonInput(dto.details ?? null)
              : undefined,
          challengeEligibility:
            typeof dto.challengeEligibility !== 'undefined'
              ? this.toNullableJsonInput(dto.challengeEligibility?.data ?? null)
              : undefined,
          templateId:
            typeof dto.templateId === 'number'
              ? BigInt(dto.templateId)
              : undefined,
          version: dto.version,
          lastActivityAt: new Date(),
          lastActivityUserId: actorUserId,
          updatedBy: auditUserId,
        },
      });

      if (statusChanged && dto.status) {
        await tx.projectHistory.create({
          data: {
            projectId: updated.id,
            status: dto.status,
            cancelReason:
              typeof dto.cancelReason === 'string' ? dto.cancelReason : null,
            updatedBy: auditUserId,
          },
        });
      }

      return updated;
    });
    const updatedBillingAccountId =
      this.toOptionalBigintString(updatedProject.billingAccountId) ?? null;
    const billingAccountChanged =
      existingBillingAccountId !== updatedBillingAccountId;

    const project = await this.prisma.project.findFirst({
      where: {
        id: updatedProject.id,
        deletedAt: null,
      },
      include: buildProjectIncludeClause(
        parseFieldsParameter('members,invites,attachments'),
      ),
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const [projectWithMemberHandles] =
      await this.enrichProjectsWithMemberHandles([project]);
    const projectWithRelations = projectWithMemberHandles || project;

    const isAdmin = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_ANY,
      user,
      projectWithRelations.members || [],
    );

    const response = this.toDto(
      this.filterProjectRelations(projectWithRelations, user, isAdmin),
    );

    this.publishEvent(KAFKA_TOPIC.PROJECT_UPDATED, response);
    if (billingAccountChanged) {
      this.publishRawEvent(KAFKA_TOPIC.PROJECT_BILLING_ACCOUNT_UPDATED, {
        projectId: response.id,
        projectName: response.name,
        directProjectId:
          this.toOptionalBigintString(updatedProject.directProjectId) ?? null,
        status: updatedProject.status,
        oldBillingAccountId: existingBillingAccountId,
        newBillingAccountId: updatedBillingAccountId,
      });
    }

    return response;
  }

  /**
   * Soft-deletes a project by setting audit deletion columns.
   *
   * Publishes `project.deleted` after persistence.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Promise resolved when deletion is complete.
   * @throws NotFoundException When the project does not exist.
   * @throws ForbiddenException When caller lacks delete permissions.
   */
  async deleteProject(projectId: string, user: JwtUser): Promise<void> {
    const parsedProjectId = this.parseProjectId(projectId);
    const actorUserId = this.getActorUserId(user);
    const auditUserId = this.getAuditUserId(user);

    const existingProject = await this.prisma.project.findFirst({
      where: {
        id: parsedProjectId,
        deletedAt: null,
      },
      include: {
        members: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    if (!existingProject) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const canDelete = this.permissionService.hasNamedPermission(
      Permission.DELETE_PROJECT,
      user,
      existingProject.members,
    );

    if (!canDelete) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.prisma.project.update({
      where: {
        id: parsedProjectId,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: BigInt(auditUserId),
        updatedBy: auditUserId,
      },
    });

    this.publishEvent(KAFKA_TOPIC.PROJECT_DELETED, {
      id: projectId,
      deletedBy: actorUserId,
    });
  }

  /**
   * Returns project permissions for the caller or, for M2M, every project user.
   *
   * Human JWT callers keep the legacy v5/v6 behavior and receive the
   * work-management policy map allowed for the authenticated caller.
   *
   * M2M callers receive a per-user matrix built from active project members.
   * Each entry includes the user's active memberships, fetched Topcoder roles,
   * named project permissions, and template work-management policies.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Legacy caller policy map or an M2M per-user permission matrix.
   * @throws NotFoundException When the project does not exist.
   */
  async getProjectPermissions(
    projectId: string,
    user: JwtUser,
  ): Promise<ProjectPermissionsResponse> {
    const parsedProjectId = this.parseProjectId(projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: parsedProjectId,
        deletedAt: null,
      },
      select: {
        templateId: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    if (this.isMachinePrincipal(user)) {
      const workManagementPermissionsPromise: Promise<
        WorkManagementPermissionRecord[]
      > = project.templateId
        ? this.prisma.workManagementPermission.findMany({
            where: {
              projectTemplateId: project.templateId,
              deletedAt: null,
            },
            select: {
              policy: true,
              permission: true,
            },
          })
        : Promise.resolve([]);

      const [projectMembers, workManagementPermissions] = await Promise.all([
        this.prisma.projectMember.findMany({
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
        }),
        workManagementPermissionsPromise,
      ]);

      return this.buildProjectMemberPermissionMatrix(
        projectMembers,
        workManagementPermissions,
      );
    }

    if (!project.templateId) {
      return {};
    }

    const [projectMembers, workManagementPermissions] = await Promise.all([
      this.prisma.projectMember.findMany({
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
      }),
      this.prisma.workManagementPermission.findMany({
        where: {
          projectTemplateId: project.templateId,
          deletedAt: null,
        },
        select: {
          policy: true,
          permission: true,
        },
      }),
    ]);

    const policyMap: ProjectPolicyMap = {};

    for (const permissionRecord of workManagementPermissions) {
      const hasPermission = this.permissionService.hasPermission(
        this.normalizeStoredPermission(permissionRecord.permission),
        user,
        projectMembers,
      );

      if (hasPermission) {
        policyMap[permissionRecord.policy] = true;
      }
    }

    return policyMap;
  }

  /**
   * Lists billing accounts available for a project and caller.
   *
   * Delegates to `BillingAccountService.getBillingAccountsForProject`.
   * Logs a warning and returns an empty list when `user.userId` is missing.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Billing account list.
   */
  async listProjectBillingAccounts(
    projectId: string,
    user: JwtUser,
  ): Promise<BillingAccount[]> {
    const normalizedProjectId = this.parseProjectId(projectId).toString();
    const userId = user.userId ? String(user.userId).trim() : '';

    if (!userId) {
      this.logger.warn(
        `Missing userId while listing billing accounts for projectId=${normalizedProjectId}.`,
      );
      return [];
    }

    return this.billingAccountService.getBillingAccountsForProject(
      normalizedProjectId,
      userId,
    );
  }

  /**
   * Returns the default billing account configured on a project.
   *
   * When Salesforce lookup is unavailable or returns an empty payload, this
   * method still returns the project-level billing-account id so downstream
   * services can continue linking billing context.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Default billing account details.
   * @throws NotFoundException When project or billing account is missing.
   * @security Removes `markup` for non-machine callers to avoid exposing
   * markup details to interactive users.
   */
  async getProjectBillingAccount(
    projectId: string,
    user: JwtUser,
  ): Promise<BillingAccount> {
    const parsedProjectId = this.parseProjectId(projectId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: parsedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
        billingAccountId: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    if (!project.billingAccountId) {
      throw new NotFoundException('Billing Account not found');
    }

    const projectBillingAccountId = project.billingAccountId.toString();
    const billingAccountFromSalesforce =
      await this.billingAccountService.getDefaultBillingAccount(
        projectBillingAccountId,
      );

    const hasResolvedBillingAccountId =
      typeof billingAccountFromSalesforce?.tcBillingAccountId === 'string' &&
      billingAccountFromSalesforce.tcBillingAccountId.trim().length > 0;
    const billingAccount: BillingAccount = hasResolvedBillingAccountId
      ? billingAccountFromSalesforce
      : {
          tcBillingAccountId: projectBillingAccountId,
        };

    if (user.isMachine) {
      return billingAccount;
    }

    const sanitizedBillingAccount = {
      ...billingAccount,
    };
    delete sanitizedBillingAccount.markup;

    return sanitizedBillingAccount;
  }

  /**
   * Upgrades project version/template values for administrative callers.
   *
   * Only `v3` is currently accepted as `targetVersion`.
   *
   * @param projectId Project id path parameter.
   * @param dto Upgrade payload.
   * @param user Authenticated caller context.
   * @returns Success message.
   * @throws ForbiddenException When caller is not admin-equivalent.
   * @throws NotFoundException When the project does not exist.
   * @throws BadRequestException When `targetVersion` is unsupported.
   * @security Performs redundant admin checks (role + scope) as
   * defense-in-depth even when controller layer already applies `@AdminOnly()`.
   */
  async upgradeProject(
    projectId: string,
    dto: UpgradeProjectDto,
    user: JwtUser,
  ): Promise<{ message: string }> {
    const hasAdminRole = this.permissionService.hasIntersection(
      user.roles || [],
      ADMIN_ROLES,
    );
    const hasAdminScope = this.permissionService.hasPermission(
      {
        scopes: [Scope.CONNECT_PROJECT_ADMIN],
      },
      user,
    );

    if (!hasAdminRole && !hasAdminScope) {
      throw new ForbiddenException('Admin access is required.');
    }

    const parsedProjectId = this.parseProjectId(projectId);
    const auditUserId = this.getAuditUserId(user);

    const project = await this.prisma.project.findFirst({
      where: {
        id: parsedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
        version: true,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    if (dto.targetVersion !== 'v3') {
      throw new BadRequestException(
        `Unsupported target version: ${dto.targetVersion}.`,
      );
    }

    const shouldUpdateVersion = project.version !== dto.targetVersion;
    const templateId =
      typeof dto.defaultProductTemplateId === 'number'
        ? BigInt(dto.defaultProductTemplateId)
        : undefined;

    if (shouldUpdateVersion || typeof templateId !== 'undefined') {
      await this.prisma.project.update({
        where: {
          id: parsedProjectId,
        },
        data: {
          ...(shouldUpdateVersion ? { version: dto.targetVersion } : {}),
          ...(typeof templateId === 'undefined' ? {} : { templateId }),
          updatedBy: auditUserId,
        },
      });
    }

    return {
      message: 'Project successfully upgraded',
    };
  }

  /**
   * Enriches member and invite records with handles.
   *
   * Collects user ids across all projects, resolves handles once, and injects
   * them into members/invites when a local handle is not already present.
   * No-ops for empty project inputs.
   *
   * @param projects Projects to enrich.
   * @returns Projects with best-effort handle enrichment.
   */
  private async enrichProjectsWithMemberHandles(
    projects: ProjectWithRawRelations[],
  ): Promise<ProjectWithRawRelations[]> {
    if (!projects.length) {
      return projects;
    }

    const userIds = this.collectProjectUserIds(projects);

    if (!userIds.length) {
      return projects;
    }

    const handlesByUserId = await this.fetchMemberHandlesByUserId(userIds);

    if (!handlesByUserId.size) {
      return projects;
    }

    return projects.map((project) => ({
      ...project,
      members: Array.isArray(project.members)
        ? project.members.map((member) => ({
            ...member,
            handle:
              this.toOptionalHandle(member.handle) ||
              this.getHandleByUserId(member.userId, handlesByUserId),
          }))
        : project.members,
      invites: Array.isArray(project.invites)
        ? project.invites.map((invite) => ({
            ...invite,
            handle:
              this.toOptionalHandle(invite.handle) ||
              this.getHandleByUserId(invite.userId, handlesByUserId),
          }))
        : project.invites,
    }));
  }

  /**
   * Extracts and deduplicates user ids from project members and invites.
   *
   * @param projects Projects to inspect.
   * @returns Unique user ids as bigint values.
   */
  private collectProjectUserIds(projects: ProjectWithRawRelations[]): bigint[] {
    const userIds = new Set<string>();

    for (const project of projects) {
      for (const member of project.members || []) {
        const parsedUserId = this.parseUserIdValue(member.userId);

        if (parsedUserId) {
          userIds.add(parsedUserId.toString());
        }
      }

      for (const invite of project.invites || []) {
        const parsedUserId = this.parseUserIdValue(invite.userId);

        if (parsedUserId) {
          userIds.add(parsedUserId.toString());
        }
      }
    }

    return Array.from(userIds).map((userId) => BigInt(userId));
  }

  /**
   * Loads member handles keyed by user id from the members schema.
   *
   * Falls back to Member API lookup when the cross-schema query fails or
   * does not fully resolve all requested user ids. If all lookups fail, this
   * returns an empty map;
   * callers should inspect logs for cross-schema or downstream API errors.
   *
   * @param userIds User ids to resolve.
   * @returns Map keyed by normalized user id string.
   * @security Uses `Prisma.join` parameterization for safe binding and avoids
   * SQL injection even though it queries across schema boundary `members.member`.
   */
  private async fetchMemberHandlesByUserId(
    userIds: bigint[],
  ): Promise<Map<string, string>> {
    if (!userIds.length) {
      return new Map();
    }

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          userId: bigint | number | string;
          handle: string | null;
        }>
      >(Prisma.sql`
        SELECT
          m."userId" AS "userId",
          m.handle AS "handle"
        FROM members.member m
        WHERE m."userId" IN (${Prisma.join(userIds)})
      `);

      const handlesByUserId = rows.reduce<Map<string, string>>((acc, row) => {
        const parsedUserId = this.parseUserIdValue(row.userId);
        const handle = this.toOptionalHandle(row.handle);

        if (parsedUserId && handle) {
          acc.set(parsedUserId.toString(), handle);
        }

        return acc;
      }, new Map());

      this.logger.debug(
        `Resolved ${handlesByUserId.size} member handle pairs from members.member for ${userIds.length} user ids.`,
      );

      const unresolvedUserIds = userIds.filter(
        (userId) => !handlesByUserId.has(userId.toString()),
      );

      if (unresolvedUserIds.length) {
        if (handlesByUserId.size === 0) {
          this.logger.warn(
            `Cross-schema handle lookup returned no usable rows for ${userIds.length} user ids; falling back to Member API.`,
          );
        } else {
          this.logger.warn(
            `Cross-schema handle lookup partially resolved member handles (${handlesByUserId.size}/${userIds.length}); falling back to Member API for ${unresolvedUserIds.length} unresolved user ids.`,
          );
        }

        const fallbackHandlesByUserId =
          await this.fetchMemberHandlesViaMemberApi(unresolvedUserIds);
        fallbackHandlesByUserId.forEach((handle, resolvedUserId) => {
          handlesByUserId.set(resolvedUserId, handle);
        });
      }

      return handlesByUserId;
    } catch (error) {
      this.logger.error(
        `Failed to fetch member handles from members.member: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return this.fetchMemberHandlesViaMemberApi(userIds);
    }
  }

  /**
   * Loads member handles through Member API as a fallback for DB handle lookups.
   *
   * @param userIds User ids to resolve.
   * @returns Map keyed by normalized user id string.
   */
  private async fetchMemberHandlesViaMemberApi(
    userIds: bigint[],
  ): Promise<Map<string, string>> {
    try {
      const memberDetails =
        await this.memberService.getMemberDetailsByUserIds(userIds);
      const handlesByUserId = memberDetails.reduce<Map<string, string>>(
        (acc, memberDetail) => {
          const parsedUserId = this.parseUserIdValue(memberDetail.userId);
          const handle = this.toOptionalHandle(memberDetail.handle);

          if (parsedUserId && handle) {
            acc.set(parsedUserId.toString(), handle);
          }

          return acc;
        },
        new Map(),
      );

      this.logger.debug(
        `Resolved ${handlesByUserId.size} member handle pairs from Member API fallback for ${userIds.length} user ids.`,
      );

      return handlesByUserId;
    } catch (error) {
      this.logger.error(
        `Failed Member API fallback for member handles: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return new Map();
    }
  }

  /**
   * Looks up a pre-fetched handle by user id.
   *
   * @param userId Input user id in mixed primitive forms.
   * @param handlesByUserId Handle lookup map.
   * @returns Resolved handle or `null` when unavailable.
   */
  private getHandleByUserId(
    userId: bigint | number | string | null | undefined,
    handlesByUserId: Map<string, string>,
  ): string | null {
    const parsedUserId = this.parseUserIdValue(userId);

    if (!parsedUserId) {
      return null;
    }

    return handlesByUserId.get(parsedUserId.toString()) || null;
  }

  /**
   * Normalizes user id values into bigint when possible.
   *
   * @param userId Candidate user id.
   * @returns Parsed bigint or `undefined` when invalid.
   */
  private parseUserIdValue(
    userId: bigint | number | string | null | undefined,
  ): bigint | undefined {
    if (typeof userId === 'bigint') {
      return userId;
    }

    if (typeof userId === 'number' && Number.isFinite(userId)) {
      return BigInt(Math.trunc(userId));
    }

    if (typeof userId === 'string') {
      const normalizedUserId = userId.trim();

      if (/^\d+$/.test(normalizedUserId)) {
        return BigInt(normalizedUserId);
      }
    }

    return undefined;
  }

  /**
   * Normalizes a handle candidate to a trimmed non-empty string.
   *
   * @param value Unknown handle candidate.
   * @returns Normalized handle or `undefined`.
   */
  private toOptionalHandle(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedHandle = value.trim();

    return normalizedHandle || undefined;
  }

  /**
   * Parses list sort expression against an allowlist.
   *
   * Supports `field [asc|desc]` input and defaults to `createdAt asc`.
   *
   * @param sort Optional sort expression.
   * @returns Prisma orderBy clause.
   * @todo Replace the nested ternary field mapping with a
   * `Map<string, string>` for readability.
   */
  private resolveSort(sort?: string): Prisma.ProjectOrderByWithRelationInput {
    const defaultOrderBy: Prisma.ProjectOrderByWithRelationInput = {
      createdAt: 'asc',
    };

    if (!sort || sort.trim().length === 0) {
      return defaultOrderBy;
    }

    const [rawField, rawDirection] = sort.trim().split(/\s+/);

    const allowedFields = new Set([
      'createdat',
      'updatedat',
      'lastactivityat',
      'id',
      'status',
      'name',
      'type',
    ]);

    const field = rawField.trim().toLowerCase();

    if (!allowedFields.has(field)) {
      return defaultOrderBy;
    }

    const direction = rawDirection?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    const prismaField =
      field === 'createdat'
        ? 'createdAt'
        : field === 'updatedat'
          ? 'updatedAt'
          : field === 'lastactivityat'
            ? 'lastActivityAt'
            : field;

    return {
      [prismaField]: direction,
    } as Prisma.ProjectOrderByWithRelationInput;
  }

  /**
   * Resolves list fields for the collection endpoint.
   *
   * Defaults `members`, `invites`, and `attachments` to `false` when no fields
   * are requested to optimize list query payload size.
   *
   * @param fieldsParam Optional fields CSV.
   * @returns Parsed field flags.
   */
  private resolveListFields(fieldsParam?: string): ParsedProjectFields {
    const parsedFields = parseFieldsParameter(fieldsParam);

    if (fieldsParam && fieldsParam.trim().length > 0) {
      return parsedFields;
    }

    return {
      ...parsedFields,
      project_members: false,
      project_member_invites: false,
      attachments: false,
    };
  }

  /**
   * Ensures include fields required for permission-aware filtering.
   *
   * Forces `project_members` when invites or attachments are requested.
   *
   * @param requestedFields Requested field flags.
   * @returns Include flags safe for relation filtering.
   */
  private resolveListIncludeFields(
    requestedFields: ParsedProjectFields,
  ): ParsedProjectFields {
    if (requestedFields.project_members) {
      return requestedFields;
    }

    if (requestedFields.project_member_invites || requestedFields.attachments) {
      return {
        ...requestedFields,
        project_members: true,
      };
    }

    return requestedFields;
  }

  /**
   * Filters relation arrays according to caller permissions.
   *
   * Applies `READ_PROJECT_MEMBER`, invite visibility checks, and attachment
   * filtering by ownership/admin status.
   *
   * @param project Project with optional relations.
   * @param user Authenticated caller context.
   * @param isAdmin Whether caller has admin-level project read privileges.
   * @returns Filtered project relation view.
   */
  private filterProjectRelations(
    project: ProjectWithRawRelations,
    user: JwtUser,
    isAdmin: boolean,
  ): ProjectWithRawRelations {
    const clone: ProjectWithRawRelations = {
      ...project,
    };

    const members = clone.members || [];

    const canReadMembers = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_MEMBER,
      user,
      members,
    );

    if (!canReadMembers) {
      clone.members = [];
    }

    const canReadInviteAll = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_INVITE_NOT_OWN,
      user,
      members,
    );

    const canReadInviteOwn = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_INVITE_OWN,
      user,
      members,
    );

    clone.invites = filterInvitesByPermission(
      clone.invites,
      user,
      canReadInviteAll,
      canReadInviteOwn,
    );

    clone.attachments = filterAttachmentsByPermission(
      clone.attachments,
      user,
      members,
      isAdmin,
    );

    return clone;
  }

  /**
   * Removes relation keys that were not explicitly requested.
   *
   * @param project Project with optional relations.
   * @param fields Parsed field flags.
   * @returns Project with unrequested relations removed.
   */
  private filterProjectFields(
    project: ProjectWithRawRelations,
    fields: ParsedProjectFields,
  ): ProjectWithRawRelations {
    const clone: ProjectWithRawRelations = {
      ...project,
    };

    if (!fields.project_members) {
      delete clone.members;
    }

    if (!fields.project_member_invites) {
      delete clone.invites;
    }

    if (!fields.attachments) {
      delete clone.attachments;
    }

    return clone;
  }

  /**
   * Validates and parses project id path input.
   *
   * @param projectId Raw project id value.
   * @returns Parsed bigint project id.
   * @throws BadRequestException When input is not a numeric string.
   */
  private parseProjectId(projectId: string): bigint {
    const normalizedProjectId = projectId.trim();

    if (!/^\d+$/.test(normalizedProjectId)) {
      throw new BadRequestException('Project id must be a numeric string.');
    }

    return BigInt(normalizedProjectId);
  }

  /**
   * Builds the M2M per-user permission matrix for a project's active members.
   *
   * Each user entry is keyed by numeric user id string and merges permission
   * decisions across all active memberships for that user.
   *
   * @param projectMembers Active project members.
   * @param workManagementPermissions Optional template policy rows.
   * @returns Per-user permission matrix keyed by user id.
   */
  private async buildProjectMemberPermissionMatrix(
    projectMembers: Array<
      Pick<ProjectMember, 'id' | 'userId' | 'role' | 'isPrimary'>
    >,
    workManagementPermissions: WorkManagementPermissionRecord[],
  ): Promise<Record<string, ProjectMemberPermissionMatrixEntry>> {
    const matrixPermissions = Object.values(Permission).filter(
      (permission): permission is Permission =>
        this.permissionService.isNamedPermissionRequireProjectMembers(
          permission,
        ),
    );
    const membershipsByUserId = new Map<
      string,
      Array<Pick<ProjectMember, 'id' | 'userId' | 'role' | 'isPrimary'>>
    >();

    for (const member of projectMembers) {
      const parsedUserId = this.parseUserIdValue(member.userId);

      if (!parsedUserId) {
        continue;
      }

      const normalizedUserId = parsedUserId.toString();
      const memberships = membershipsByUserId.get(normalizedUserId) || [];
      memberships.push(member);
      membershipsByUserId.set(normalizedUserId, memberships);
    }

    const topcoderRolesByUserId = new Map<string, string[]>(
      await Promise.all(
        Array.from(membershipsByUserId.keys()).map(
          async (userId): Promise<[string, string[]]> => [
            userId,
            await this.memberService.getUserRoles(userId),
          ],
        ),
      ),
    );
    const permissionMatrix: Record<string, ProjectMemberPermissionMatrixEntry> =
      {};

    for (const [userId, memberships] of membershipsByUserId.entries()) {
      const topcoderRoles = topcoderRolesByUserId.get(userId) || [];
      const matrixUser: JwtUser = {
        userId,
        roles: topcoderRoles,
        scopes: [],
        isMachine: false,
      };
      const projectPermissions: ProjectPolicyMap = {};
      const workManagementPolicies: ProjectPolicyMap = {};

      for (const permission of matrixPermissions) {
        const hasPermission = memberships.some((membership) =>
          this.permissionService.hasNamedPermission(permission, matrixUser, [
            membership,
          ]),
        );

        if (hasPermission) {
          projectPermissions[permission] = true;
        }
      }

      for (const permissionRecord of workManagementPermissions) {
        const normalizedPermission = this.normalizeStoredPermission(
          permissionRecord.permission,
        );
        const hasPermission = memberships.some((membership) =>
          this.permissionService.hasPermission(
            normalizedPermission,
            matrixUser,
            [membership],
          ),
        );

        if (hasPermission) {
          workManagementPolicies[permissionRecord.policy] = true;
        }
      }

      permissionMatrix[userId] = {
        memberships: memberships.map((membership) => ({
          memberId:
            this.toOptionalBigintString(membership.id) || String(membership.id),
          role: membership.role,
          isPrimary: Boolean(membership.isPrimary),
        })),
        topcoderRoles,
        projectPermissions,
        workManagementPolicies,
      };
    }

    return permissionMatrix;
  }

  /**
   * Returns the authenticated actor user id as trimmed string.
   *
   * @param user Authenticated caller context.
   * @returns Trimmed actor user id, or a machine-principal id from token
   * claims when a human user id is unavailable.
   * @throws ForbiddenException When neither human nor machine actor identity is
   * available.
   */
  private getActorUserId(user: JwtUser): string {
    if (!user.userId || String(user.userId).trim().length === 0) {
      const machineActorId = this.getMachineActorId(user);
      if (machineActorId) {
        return machineActorId;
      }

      throw new ForbiddenException('Authenticated user id is missing.');
    }

    return String(user.userId).trim();
  }

  /**
   * Parses actor id into numeric audit column representation.
   *
   * @param user Authenticated caller context.
   * @returns Numeric actor id, or `-1` for machine principals without numeric
   * ids.
   * @throws ForbiddenException When actor id is missing or non-numeric for a
   * non-machine caller.
   */
  private getAuditUserId(user: JwtUser): number {
    const actorId = this.getActorUserId(user);
    const parsedActorId = Number.parseInt(actorId, 10);

    if (Number.isNaN(parsedActorId)) {
      if (this.isMachinePrincipal(user)) {
        return -1;
      }

      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    return parsedActorId;
  }

  /**
   * Normalizes stored work-management permission payloads into the runtime
   * permission shape expected by `PermissionService`.
   *
   * Legacy rows may use `{ allow: { roles: [...] } }`, where `roles` maps to
   * project-member roles.
   */
  private normalizeStoredPermission(permission: unknown): JsonPermission {
    const normalizedPermission = this.toJsonRecord(permission);

    if (!normalizedPermission) {
      return {};
    }

    const hasExplicitAllow =
      Object.prototype.hasOwnProperty.call(normalizedPermission, 'allowRule') ||
      Object.prototype.hasOwnProperty.call(normalizedPermission, 'allow');
    const allowSource = hasExplicitAllow
      ? (normalizedPermission.allowRule ?? normalizedPermission.allow)
      : normalizedPermission;
    const allowRule = this.normalizeStoredPermissionRule(allowSource);
    const denyRule = this.normalizeStoredPermissionRule(
      normalizedPermission.denyRule ?? normalizedPermission.deny,
    );

    if (hasExplicitAllow) {
      return {
        ...(allowRule ? { allowRule } : {}),
        ...(denyRule ? { denyRule } : {}),
      };
    }

    return {
      ...(allowRule || {}),
      ...(denyRule ? { denyRule } : {}),
    };
  }

  /**
   * Normalizes one stored permission rule.
   */
  private normalizeStoredPermissionRule(
    rule: unknown,
  ): JsonPermissionRule | undefined {
    const normalizedRule = this.toJsonRecord(rule);

    if (!normalizedRule) {
      return undefined;
    }

    const projectRoles = this.normalizeStoredProjectRoles(
      normalizedRule.projectRoles ?? normalizedRule.roles,
    );
    const topcoderRoles = this.normalizeStoredRoleList(
      normalizedRule.topcoderRoles,
    );
    const scopes = this.normalizeStoredStringArray(normalizedRule.scopes);

    return {
      ...(typeof projectRoles === 'undefined' ? {} : { projectRoles }),
      ...(typeof topcoderRoles === 'undefined' ? {} : { topcoderRoles }),
      ...(typeof scopes === 'undefined' ? {} : { scopes }),
    };
  }

  /**
   * Coerces legacy string-list values into permission-list form.
   */
  private normalizeStoredRoleList(
    value: unknown,
  ): string[] | boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    return this.normalizeStoredStringArray(value);
  }

  /**
   * Coerces legacy array values into trimmed string arrays.
   */
  private normalizeStoredStringArray(value: unknown): string[] | undefined {
    if (typeof value === 'boolean') {
      return undefined;
    }

    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  /**
   * Coerces legacy project-role values into `PermissionRule.projectRoles`.
   */
  private normalizeStoredProjectRoles(
    value: unknown,
  ): JsonPermissionRule['projectRoles'] | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          const normalizedRole = entry.trim();
          return normalizedRole.length > 0 ? normalizedRole : null;
        }

        const normalizedRule = this.toJsonRecord(entry);
        const role =
          typeof normalizedRule?.role === 'string'
            ? normalizedRule.role.trim()
            : '';

        if (!role) {
          return null;
        }

        return {
          role,
          ...(typeof normalizedRule?.isPrimary === 'boolean'
            ? { isPrimary: normalizedRule.isPrimary }
            : {}),
        };
      })
      .filter(
        (entry): entry is string | { role: string; isPrimary?: boolean } =>
          Boolean(entry),
      );
  }

  /**
   * Returns a plain object record for JSON-like permission payloads.
   */
  private toJsonRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  /**
   * Checks whether an identifier is a numeric string.
   */
  private isNumericIdentifier(value: string): boolean {
    return /^\d+$/.test(value);
  }

  /**
   * Resolves a stable machine-principal identifier from token claims.
   */
  private getMachineActorId(user: JwtUser): string | undefined {
    if (!this.isMachinePrincipal(user) || !user.tokenPayload) {
      return undefined;
    }

    for (const key of ['sub', 'azp', 'client_id', 'clientId']) {
      const value = user.tokenPayload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  /**
   * Determines whether the caller is a machine principal.
   *
   * Falls back to raw token claims so service-layer audit logic still works
   * when upstream normalization omits `user.isMachine`.
   */
  private isMachinePrincipal(user: JwtUser): boolean {
    if (user.isMachine) {
      return true;
    }

    if (!user.tokenPayload) {
      return false;
    }

    const grantType = user.tokenPayload.gty;
    if (
      typeof grantType === 'string' &&
      grantType.trim().toLowerCase() === 'client-credentials'
    ) {
      return true;
    }

    const rawScopes = user.tokenPayload.scope ?? user.tokenPayload.scopes;

    if (typeof rawScopes === 'string') {
      return rawScopes.trim().length > 0;
    }

    if (Array.isArray(rawScopes)) {
      return rawScopes.some((scope) => String(scope).trim().length > 0);
    }

    return false;
  }

  /**
   * Safely extracts template phase objects from JSON payload.
   *
   * @param templatePhases Raw template phases JSON value.
   * @returns Typed phase object list.
   */
  private extractTemplatePhases(
    templatePhases: Prisma.JsonValue,
  ): Array<Record<string, any>> {
    if (!Array.isArray(templatePhases)) {
      return [];
    }

    return templatePhases.filter(
      (phase): phase is Record<string, any> =>
        Boolean(phase) && typeof phase === 'object',
    );
  }

  /**
   * Creates project estimation and estimation-item rows in a transaction.
   *
   * Validates `buildingBlockKey` before creating rows.
   *
   * @param prismaTx Active Prisma transaction client.
   * @param estimation Estimation payload to persist.
   * @param projectId Project id for association.
   * @param auditUserId Numeric audit actor id.
   * @returns Promise resolved when estimation rows are persisted.
   * @throws BadRequestException When `buildingBlockKey` is unknown.
   */
  private async createEstimation(
    prismaTx: Prisma.TransactionClient,
    estimation: EstimationDto,
    projectId: bigint,
    auditUserId: number,
  ): Promise<void> {
    const buildingBlock = await prismaTx.buildingBlock.findFirst({
      where: {
        key: estimation.buildingBlockKey,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!buildingBlock) {
      throw new BadRequestException(
        `Unknown building block key: ${estimation.buildingBlockKey}`,
      );
    }

    const createdEstimation = await prismaTx.projectEstimation.create({
      data: {
        projectId,
        buildingBlockKey: estimation.buildingBlockKey,
        conditions: estimation.conditions,
        price: estimation.price,
        quantity: estimation.quantity,
        minTime: estimation.minTime,
        maxTime: estimation.maxTime,
        metadata: this.toJsonInput(estimation.metadata || {}),
        createdBy: auditUserId,
        updatedBy: auditUserId,
      },
    });

    if (Array.isArray(estimation.items) && estimation.items.length > 0) {
      await prismaTx.projectEstimationItem.createMany({
        data: estimation.items.map((item) => ({
          projectEstimationId: createdEstimation.id,
          price: item.price,
          type: item.type,
          markupUsedReference: item.markupUsedReference,
          markupUsedReferenceId: BigInt(item.markupUsedReferenceId),
          metadata: this.toJsonInput(item.metadata || {}),
          createdBy: auditUserId,
          updatedBy: auditUserId,
        })),
      });
    }
  }

  /**
   * Fire-and-forget event publication wrapper.
   *
   * Logs publication failures and intentionally does not rethrow.
   *
   * @param topic Kafka topic name.
   * @param payload Event payload.
   */
  private publishEvent(topic: string, payload: unknown): void {
    void publishProjectEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish event topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  /**
   * Fire-and-forget raw event publication wrapper (no resource envelope).
   *
   * Logs publication failures and intentionally does not rethrow.
   *
   * @param topic Kafka topic name.
   * @param payload Raw event payload.
   */
  private publishRawEvent(topic: string, payload: unknown): void {
    void publishRawBusEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish raw event topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  /**
   * Converts raw project entity into API DTO shape.
   *
   * @param project Raw project entity.
   * @returns Serialized project DTO.
   */
  private toDto(project: ProjectWithRawRelations): ProjectWithRelationsDto {
    return this.normalizeProjectEntity(
      project,
    ) as unknown as ProjectWithRelationsDto;
  }

  /**
   * Converts nullable values into Prisma JSON input type.
   *
   * @param value Value to convert.
   * @returns Prisma nullable JSON input.
   * @todo Consolidate with `toJsonInput`; both methods are nearly identical
   * and differ primarily in return type annotations.
   */
  private toNullableJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  /**
   * Converts values into Prisma JSON input type.
   *
   * @param value Value to convert.
   * @returns Prisma JSON input.
   * @todo Consolidate with `toNullableJsonInput`; both methods are nearly
   * identical and can be unified with a generic/union helper.
   */
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
   * Recursively normalizes project payload values for JSON serialization.
   *
   * Converts `bigint` to string and `Prisma.Decimal` to number while
   * preserving arrays, objects, and `Date` instances.
   *
   * @param payload Payload to normalize.
   * @returns Normalized payload.
   */
  private normalizeProjectEntity<T>(payload: T): T {
    const walk = (input: unknown): unknown => {
      if (typeof input === 'bigint') {
        return input.toString();
      }

      if (input instanceof Prisma.Decimal) {
        return Number(input.toString());
      }

      if (Array.isArray(input)) {
        return input.map((entry) => walk(entry));
      }

      if (input && typeof input === 'object') {
        if (input instanceof Date) {
          return input;
        }

        const output: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(input)) {
          output[key] = walk(value);
        }

        return output;
      }

      return input;
    };

    return walk(payload) as T;
  }

  /**
   * Converts optional bigint to optional string.
   *
   * @param value Bigint value.
   * @returns String representation or `undefined`.
   */
  private toOptionalBigintString(
    value: bigint | null | undefined,
  ): string | undefined {
    if (typeof value !== 'bigint') {
      return undefined;
    }

    return value.toString();
  }

  /**
   * Batch-loads billing account names for project list responses.
   *
   * @param projects Project rows that may contain billing-account ids.
   * @returns Map of billing account id to billing account name.
   */
  private async getBillingAccountNamesById(
    projects: Project[],
  ): Promise<Map<string, string>> {
    const billingAccountIds = Array.from(
      new Set(
        projects
          .map((project) =>
            this.toOptionalBigintString(project.billingAccountId),
          )
          .filter((billingAccountId): billingAccountId is string =>
            Boolean(billingAccountId),
          ),
      ),
    );

    if (billingAccountIds.length === 0) {
      return new Map();
    }

    const billingAccountsById =
      await this.billingAccountService.getBillingAccountsByIds(
        billingAccountIds,
      );

    return Object.entries(billingAccountsById).reduce<Map<string, string>>(
      (acc, [billingAccountId, billingAccount]) => {
        const billingAccountName =
          typeof billingAccount?.name === 'string'
            ? billingAccount.name.trim()
            : '';

        if (billingAccountName) {
          acc.set(billingAccountId, billingAccountName);
        }

        return acc;
      },
      new Map(),
    );
  }
}
