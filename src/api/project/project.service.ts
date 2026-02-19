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
import { Permission as JsonPermission } from 'src/shared/interfaces/permission.interface';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  BillingAccount,
  BillingAccountService,
} from 'src/shared/services/billingAccount.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { publishProjectEvent } from 'src/shared/utils/event.utils';
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
export class ProjectService {
  private readonly logger = LoggerService.forRoot('ProjectService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly billingAccountService: BillingAccountService,
  ) {}

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

    return this.toDto(projectWithRequestedFields);
  }

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

    if (
      typeof dto.billingAccountId !== 'undefined' &&
      String(existingProject.billingAccountId || '') !==
        String(dto.billingAccountId)
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
          billingAccountId:
            typeof dto.billingAccountId === 'number'
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
            updatedBy: auditUserId,
          },
        });
      }

      return updated;
    });

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

    return response;
  }

  async deleteProject(projectId: string, user: JwtUser): Promise<void> {
    const parsedProjectId = this.parseProjectId(projectId);
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
      deletedBy: user.userId,
    });
  }

  async getProjectPermissions(
    projectId: string,
    user: JwtUser,
  ): Promise<Record<string, boolean>> {
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

    const policyMap: Record<string, boolean> = {};

    for (const permissionRecord of workManagementPermissions) {
      const hasPermission = this.permissionService.hasPermission(
        (permissionRecord.permission || {}) as JsonPermission,
        user,
        projectMembers,
      );

      if (hasPermission) {
        policyMap[permissionRecord.policy] = true;
      }
    }

    return policyMap;
  }

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

    const billingAccount =
      (await this.billingAccountService.getDefaultBillingAccount(
        project.billingAccountId.toString(),
      )) || {};

    if (user.isMachine) {
      return billingAccount;
    }

    const sanitizedBillingAccount = {
      ...billingAccount,
    };
    delete sanitizedBillingAccount.markup;

    return sanitizedBillingAccount;
  }

  async upgradeProject(
    projectId: string,
    dto: UpgradeProjectDto,
    user: JwtUser,
  ): Promise<{ message: string }> {
    const hasAdminRole = this.permissionService.hasIntersection(
      user.roles || [],
      ADMIN_ROLES,
    );
    const hasAdminScope = (user.scopes || []).includes(
      Scope.CONNECT_PROJECT_ADMIN,
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

      return rows.reduce<Map<string, string>>((acc, row) => {
        const parsedUserId = this.parseUserIdValue(row.userId);
        const handle = this.toOptionalHandle(row.handle);

        if (parsedUserId && handle) {
          acc.set(parsedUserId.toString(), handle);
        }

        return acc;
      }, new Map());
    } catch (error) {
      this.logger.warn(
        `Failed to fetch member handles from members.member: ${error instanceof Error ? error.message : String(error)}`,
      );
      return new Map();
    }
  }

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

  private toOptionalHandle(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalizedHandle = value.trim();

    return normalizedHandle || undefined;
  }

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

  private parseProjectId(projectId: string): bigint {
    const normalizedProjectId = projectId.trim();

    if (!/^\d+$/.test(normalizedProjectId)) {
      throw new BadRequestException('Project id must be a numeric string.');
    }

    return BigInt(normalizedProjectId);
  }

  private getActorUserId(user: JwtUser): string {
    if (!user.userId || String(user.userId).trim().length === 0) {
      throw new ForbiddenException('Authenticated user id is missing.');
    }

    return String(user.userId).trim();
  }

  private getAuditUserId(user: JwtUser): number {
    const actorId = this.getActorUserId(user);
    const parsedActorId = Number.parseInt(actorId, 10);

    if (Number.isNaN(parsedActorId)) {
      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    return parsedActorId;
  }

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

  private publishEvent(topic: string, payload: unknown): void {
    void publishProjectEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish event topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  private toDto(project: ProjectWithRawRelations): ProjectWithRelationsDto {
    return this.normalizeProjectEntity(
      project,
    ) as unknown as ProjectWithRelationsDto;
  }

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

  private toOptionalBigintString(
    value: bigint | null | undefined,
  ): string | undefined {
    if (typeof value !== 'bigint') {
      return undefined;
    }

    return value.toString();
  }

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
