/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import * as moment from 'moment';
import { PrismaService } from 'src/shared/services/prisma.service';
import { EventBusService } from 'src/shared/services/event-bus.service';
import {
  CreateProjectDto,
  ProjectResponseDto,
  QueryProjectDto,
  UpdateProjectDto,
  ProjectCriteria,
} from './project.dto';
import { SearchResult } from 'src/shared/dto/common.dto';
import { JwtUser } from 'src/auth/auth.dto';
import Utils from 'src/shared/utils';
import {
  pick,
  get,
  set,
  omit,
  includes,
  defaults,
  assign,
  cloneDeep,
  isArray,
  uniq,
} from 'lodash';
import { PERMISSION } from 'src/auth/constants';
import {
  DEFAULT_PAGE_SIZE,
  PROJECT_STATUS,
  PROJECT_MEMBER_NON_CUSTOMER_ROLES,
  INVITE_STATUS,
  PROJECT_MEMBER_ROLE,
  PROJECT_PHASE_STATUS,
  EVENT,
  BUS_API_EVENT,
  RESOURCES,
  WORKSTREAM_STATUS,
} from 'src/shared/constants';
import { AppConfig } from 'config/config';

export const ALLOWED_PROJECT_FIELDS = [
  'id',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'deletedBy',
  'status',
  'name',
  'description',
  'projectFullText',
  'billingAccountId',
  'directProjectId',
  'type',
  'version',
  'templateId',
  'estimatedPrice',
  'actualPrice',
  'cancelReason',
  'terms',
  'groups',
  'lastActivityAt',
  'lastActivityUserId',
  'projectUrl',

  'details',
  'external',
  'challengeEligibility',
  'estimation',
  'attachments',
  'bookmarks',
  'invites',
  'phases',
];

const sortableProps = [
  'createdAt',
  'createdAt asc',
  'createdAt desc',
  'updatedAt',
  'updatedAt asc',
  'updatedAt desc',
  'lastActivityAt',
  'lastActivityAt asc',
  'lastActivityAt desc',
  'id',
  'id asc',
  'id desc',
  'status',
  'status asc',
  'status desc',
  'name',
  'name asc',
  'name desc',
  'type',
  'type asc',
  'type desc',
];

/**
 * Service responsible for handling project-related business logic
 * and database operations.
 */
@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  // Inject PrismaService for database access
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Creates a new project in the system.
   * @param authUser - Authenticated user information from JWT
   * @param createProjectDto - Data required to create a new project
   * @returns Promise containing the created project response
   */
  async createProject(
    createProjectDto: CreateProjectDto,
    req: Request,
  ): Promise<ProjectResponseDto> {
    const projectData = cloneDeep(createProjectDto);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    await this.checkProjectType(projectData.type);

    if (
      projectData.directProjectId &&
      !Utils.hasPermissionByReq(
        PERMISSION.MANAGE_PROJECT_DIRECT_PROJECT_ID,
        req,
      )
    ) {
      // follow original codes, throw 400 error
      throw new BadRequestException(
        "You do not have permission to set 'directProjectId' property",
      );
    }

    // by default connect admin and managers joins projects as manager
    const userRole = Utils.hasPermissionByReq(
      PERMISSION.CREATE_PROJECT_AS_MANAGER,
      req,
    )
      ? PROJECT_MEMBER_ROLE.MANAGER
      : PROJECT_MEMBER_ROLE.CUSTOMER;

    defaults(projectData, {
      description: '',
      createdBy: authUser.userId,
      updatedBy: authUser.userId,
    });

    // override values
    assign(projectData, {
      status: PROJECT_STATUS.IN_REVIEW,
      createdBy: authUser.userId,
      updatedBy: authUser.userId,
      lastActivityAt: new Date(),
      lastActivityUserId: authUser.userId!.toString(10),
      members: {
        create: [
          {
            isPrimary: true,
            role: userRole,
            userId: authUser.userId,
            handle: authUser.handle,
            email: authUser.email,
            updatedBy: authUser.userId,
            createdBy: authUser.userId,
          },
        ],
      },
    });

    // backward compatibility for releasing the service before releasing the front end
    if (!projectData.templateId) {
      projectData.version = 'v2';
    }

    if (projectData.utm) {
      projectData.utm = {
        create: {
          ...projectData.utm,
          createdBy: authUser.userId,
        },
      };
    }

    if (projectData.external) {
      projectData.external = {
        create: {
          ...projectData.external,
          createdBy: authUser.userId,
        },
      };
    }

    if (projectData.bookmarks && projectData.bookmarks.length > 0) {
      projectData.bookmarks = {
        create: projectData.bookmarks.map((item) => ({
          ...item,
          createdBy: authUser.userId,
        })),
      };
    } else {
      delete projectData.bookmarks;
    }

    if (
      projectData.challengeEligibility &&
      projectData.challengeEligibility.length > 0
    ) {
      projectData.challengeEligibility = {
        create: projectData.challengeEligibility.map((item) => ({
          ...item,
          createdBy: authUser.userId,
        })),
      };
    } else {
      delete projectData.challengeEligibility;
    }

    if (projectData.estimation && projectData.estimation.length > 0) {
      projectData.estimation = {
        create: projectData.estimation.map((item) => ({
          ...item,
          metadata: item.metadata
            ? {
                create: {
                  ...item.metadata,
                  createdBy: authUser.userId,
                },
              }
            : undefined,
          createdBy: authUser.userId,
        })),
      };
    } else {
      delete projectData.estimation;
    }

    if (projectData.attachments) {
      const attachments = projectData.attachments.map((item) =>
        assign(item, {
          createdBy: authUser.userId,
        }),
      );
      projectData.attachments = {
        create: attachments,
      };
    } else {
      delete projectData.bookmarks;
    }

    if (projectData.details && Object.keys(projectData.details).length > 0) {
      if (projectData.details.utm) {
        projectData.details.utm = {
          create: {
            ...projectData.details.utm,
            createdBy: authUser.userId,
          },
        };
      }

      if (projectData.details.appDefinition) {
        projectData.details.appDefinition = {
          create: {
            ...projectData.details.appDefinition,
            createdBy: authUser.userId,
          },
        };
      }

      if (projectData.details.projectData) {
        projectData.details.projectData = {
          create: {
            ...projectData.details.projectData,
            createdBy: authUser.userId,
          },
        };
      }

      if (projectData.details.techstack) {
        projectData.details.techstack = {
          create: {
            ...projectData.details.techstack,
            createdBy: authUser.userId,
          },
        };
      }

      if (projectData.details.apiDefinition) {
        projectData.details.apiDefinition = {
          create: {
            ...projectData.details.apiDefinition,
            createdBy: authUser.userId,
          },
        };
      }

      projectData.details = {
        create: {
          ...projectData.details,
          createdBy: authUser.userId,
        },
      };
    } else {
      delete projectData.details;
    }

    const { phasesList, workstreamsConfig } =
      await this.validateAndFetchTemplates(projectData.templateId);

    if (workstreamsConfig) {
      if (!projectData.details || !projectData.details.create) {
        projectData.details = {
          create: {
            createdBy: authUser.userId,
          },
        };
      }
      if (
        projectData.details.create.setting &&
        projectData.details.create.setting.create
      ) {
        projectData.details.create.setting.create = {
          workstreams: true,
          createdBy: authUser.userId,
        };
      } else {
        projectData.details.create.setting = {
          create: {
            workstreams: true,
            createdBy: authUser.userId,
          },
        };
      }
    }

    if (phasesList && phasesList.length > 0) {
      const projectPhases = phasesList.map((phase, phaseIdx) => {
        const duration = get(phase, 'duration', 1);
        const startDate = moment.utc().hours(0).minutes(0).seconds(0);
        return {
          name: get(phase, 'name', `Stage ${phaseIdx}`),
          duration,
          startDate: startDate.format(),
          endDate: moment
            .utc(startDate)
            .add(duration - 1, 'days')
            .format(),
          status: get(phase, 'status', PROJECT_PHASE_STATUS.DRAFT),
          budget: get(phase, 'budget', 0),
          updatedBy: authUser.userId,
          createdBy: authUser.userId,
        };
      });
      projectData.phases = {
        create: projectPhases,
      };
    }

    let result = await this.prisma.$transaction(async (tx) => {
      this.logger.debug('creating project with nested items');
      const entity = await tx.project.create({
        data: projectData,
        include: {
          details: {
            include: {
              utm: true,
              setting: true,
              appDefinition: true,
              projectData: true,
              techstack: true,
              apiDefinition: true,
            },
          },
          external: true,
          challengeEligibility: true,
          estimation: {
            include: {
              metadata: true,
            },
          },
          attachments: true,
          bookmarks: true,
          members: true,
          phases: {
            include: {
              products: true,
            },
          },
        },
      });
      this.logger.debug(
        `new project created (id# ${entity.id}, name: ${entity.name})`,
      );

      if (workstreamsConfig) {
        this.logger.debug('creating project workstreams');
        await tx.workStream.create({
          data: {
            ...workstreamsConfig,
            status: WORKSTREAM_STATUS.DRAFT,
            createdBy: authUser.userId,
          },
        });
      } else {
        this.logger.debug('no workstream config found');
      }

      // add to project history asynchronously
      this.logger.debug('creating project history');
      await tx.projectHistory.create({
        data: {
          projectId: entity.id,
          status: PROJECT_STATUS.IN_REVIEW as any,
          cancelReason: null,
          updatedBy: authUser.userId,
        },
      });
      this.logger.debug(`project history created for project ${entity.id}`);

      return entity;
    });

    // omit deletedAt and check attachment access permission
    result = this.checkAttachmentPermissionAndOmitDeletedAt(result, req);

    // emit event
    this.logger.debug(`Sending event to Kafka bus for project ${result.id}`);
    const payload = {
      project: assign({ resource: RESOURCES.PROJECT }, result),
    };
    await this.eventBus.postBusEvent(BUS_API_EVENT.PROJECT_CREATED, payload);

    return result as any;
  }

  /**
   * Check the project type whether valid
   * @param projectType - Project type
   */
  private async checkProjectType(projectType: string) {
    if (projectType) {
      const entity = await this.prisma.projectType.findFirst({
        where: {
          key: projectType,
        },
      });

      if (!entity) {
        throw new BadRequestException(
          `Project type not found for key ${projectType}`,
        );
      }
    }
  }

  /**
   * Validate template id and return related entities
   * @param templateId - The template id
   * @returns project template and related entities
   */
  private async validateAndFetchTemplates(templateId: number | undefined) {
    if (templateId) {
      const projectTemplate = await this.prisma.projectTemplate.findUnique({
        where: {
          id: templateId,
        },
      });

      if (!projectTemplate) {
        throw new BadRequestException(
          `Project template not found for id ${templateId}`,
        );
      }

      // for old projectTemplate with `phases` just get phases config directly from projectTemplate
      if (projectTemplate.phases) {
        // for now support both ways: creating phases and creating workstreams
        const phasesList = get(projectTemplate.phases, 'values');
        const workstreamsConfig = get(
          projectTemplate.phases,
          'workstreamsConfig',
        );
        const productTemplates = await this.getProductTemplates(phasesList);

        return {
          projectTemplate,
          productTemplates,
          phasesList,
          workstreamsConfig,
        };
      }

      if (projectTemplate.planConfig) {
        const planConfig = await this.prisma.planConfig.findFirst({
          where: {
            key: get(projectTemplate.planConfig, 'key'),
            version: get(projectTemplate.planConfig, 'version'),
          },
          orderBy: {
            revision: 'desc',
          },
        });

        if (!planConfig) {
          throw new BadRequestException(
            `Cannot find planConfig ${JSON.stringify(projectTemplate.planConfig)}`,
          );
        }

        // for now support both ways: creating phases and creating workstreams
        const phasesList = get(planConfig.config, 'values');
        const workstreamsConfig = get(planConfig.config, 'workstreamsConfig');
        const productTemplates = await this.getProductTemplates(phasesList);

        return {
          projectTemplate,
          productTemplates,
          phasesList,
          workstreamsConfig,
        };
      }

      return { projectTemplate };
    }

    return {};
  }

  private async getProductTemplates(phasesList) {
    let productTemplates: any = [];
    if (phasesList && phasesList.length > 0) {
      let productTemplateIds: any = [];
      phasesList.forEach((phase) => {
        if (phase.products && isArray(phase.products)) {
          if (phase.products.length > AppConfig.maxPhaseProductCount) {
            throw new BadRequestException(
              `Number of products per phase cannot exceed ${AppConfig.maxPhaseProductCount}`,
            );
          }

          phase.products.forEach((product) => {
            productTemplateIds.push(product.templateId);
          });
        }
      });
      productTemplateIds = uniq(productTemplateIds);

      if (productTemplateIds.length > 0) {
        productTemplates = await this.prisma.productTemplate.findMany({
          where: {
            id: {
              in: productTemplateIds,
            },
          },
        });
      }
    }

    return productTemplates;
  }

  /**
   * Searches for projects based on provided query parameters.
   * @param dto - Query parameters for project search
   * @returns Promise containing array of matching project responses
   */
  async searchProject(
    dto: QueryProjectDto,
    req: Request,
  ): Promise<SearchResult<ProjectResponseDto>> {
    let selectFields =
      Utils.parseCommaSeparatedString(dto.fields, ALLOWED_PROJECT_FIELDS) ||
      ALLOWED_PROJECT_FIELDS;

    if (dto.sort && !includes(sortableProps, dto.sort)) {
      throw new BadRequestException(
        `Sort param ${dto.sort} is not allowed, allowed sort param: ${JSON.stringify(sortableProps)}`,
      );
    }
    let sortParam = { createdAt: 'asc' };
    if (dto.sort) {
      const sortStrs = dto.sort.split(' ');
      const order = sortStrs.length === 2 ? sortStrs[1] : 'asc';
      sortParam = set({}, sortStrs[0], order);
    }

    const filterParam: any = {
      AND: [],
    };

    if (dto.id && dto.id.length > 0) {
      filterParam.AND.push({
        id: {
          in: dto.id,
        },
      });
    }

    if (dto.name && dto.name.trim().length > 0) {
      filterParam.AND.push({
        name: dto.name,
      });
    }

    if (dto.directProjectId) {
      filterParam.AND.push({
        directProjectId: dto.directProjectId,
      });
    }

    if (dto.status) {
      filterParam.AND.push({
        status: {
          in: dto.status,
        },
      });
    }

    if (dto.type) {
      filterParam.AND.push({
        type: {
          in: dto.type,
        },
      });
    }

    if (dto.keyword) {
      filterParam.AND.push({
        projectFullText: {
          contains: dto.keyword,
          mode: 'insensitive',
        },
      });
    }

    if (dto.code) {
      filterParam.AND.push({
        details: {
          utm: {
            code: dto.code,
          },
        },
      });
    }

    if (dto.customer) {
      filterParam.AND.push({
        members: {
          some: {
            OR: [
              {
                handle: dto.customer,
                role: 'customer',
              },
              {
                firstName: dto.customer,
                role: 'customer',
              },
              {
                lastName: dto.customer,
                role: 'customer',
              },
            ],
          },
        },
      });
    }

    if (dto.manager) {
      filterParam.AND.push({
        members: {
          some: {
            OR: [
              {
                handle: dto.manager,
                role: {
                  in: PROJECT_MEMBER_NON_CUSTOMER_ROLES,
                },
              },
              {
                firstName: dto.manager,
                role: {
                  in: PROJECT_MEMBER_NON_CUSTOMER_ROLES,
                },
              },
              {
                lastName: dto.manager,
                role: {
                  in: PROJECT_MEMBER_NON_CUSTOMER_ROLES,
                },
              },
            ],
          },
        },
      });
    }

    // regular users can only see projects they are members of (or invited, handled below)
    const authUser = get(req, 'authUser');
    if (authUser) {
      const isAdmin = Utils.hasAdminRole(authUser);

      if (!isAdmin) {
        const userId = authUser.userId;
        const email = authUser.email;

        if (userId) {
          filterParam.AND.push({
            OR: [
              {
                members: {
                  some: {
                    userId: userId,
                  },
                },
              },
              {
                memberInvites: {
                  some: {
                    userId: userId,
                    status: INVITE_STATUS.PENDING,
                  },
                },
              },
            ],
          });
        }

        if (email) {
          filterParam.AND.push({
            memberInvites: {
              some: {
                email: email,
                status: INVITE_STATUS.PENDING,
              },
            },
          });
        }
      }
    }

    const total = await this.prisma.project.count({ where: filterParam });

    // prepare pagination
    const take = dto.perPage || DEFAULT_PAGE_SIZE;
    const skip = take * ((dto.page || 1) - 1);

    let entities = await this.prisma.project.findMany({
      where: filterParam,
      include: {
        details: {
          include: {
            utm: true,
            setting: true,
            appDefinition: true,
            projectData: true,
            techstack: true,
            apiDefinition: true,
          },
        },
        attachments: true,
        members: true,
        memberInvites: {
          where: {
            status: {
              in: ['pending', 'requested'],
            },
          },
        },
        phases: {
          include: {
            products: true,
            members: true,
          },
        },
      },
      take,
      skip,
      orderBy: sortParam as any,
    });

    // check context for project members
    if (!dto.fields || dto.fields.indexOf('members') > -1) {
      if (Utils.hasPermissionByReq(PERMISSION.READ_PROJECT_MEMBER, req)) {
        selectFields.push('members');
      }
    }

    const inviteNotOwnPermission = Utils.hasPermissionByReq(
      PERMISSION.READ_PROJECT_INVITE_NOT_OWN,
      req,
    );
    const inviteOwnPermission = Utils.hasPermissionByReq(
      PERMISSION.READ_PROJECT_INVITE_OWN,
      req,
    );

    entities = entities.map((entity: any) => {
      if (!dto.fields || dto.fields.indexOf('invites') > -1) {
        // include all invites
        if (inviteNotOwnPermission) {
          selectFields.push('invites');
          set(entity, 'invites', entity.memberInvites);
        } else if (inviteOwnPermission) {
          // include only own invites
          selectFields.push('invites');
          const authUser = get(req, 'authUser');
          if (entity.memberInvites) {
            const memberInvites = entity.memberInvites.filter(
              (item) =>
                (item.userId !== null &&
                  String(item.userId) === String(authUser.userId)) ||
                (item.email &&
                  authUser.email &&
                  item.email.toLocaleLowerCase() ===
                    authUser.email.toLocaleLowerCase()),
            );

            set(entity, 'invites', memberInvites);
          } else {
            set(entity, 'invites', []);
          }
        }
      }

      if (!dto.fields || dto.fields.indexOf('attachments') === -1) {
        const idx = selectFields.indexOf('attachments');

        selectFields = [...selectFields];
        selectFields.splice(idx, 1);
      }

      let entityItem = pick(entity, selectFields) as any;

      // omit deletedAt and check attachment access permission
      entityItem = this.checkAttachmentPermissionAndOmitDeletedAt(
        entityItem,
        req,
      );

      return entityItem;
    });

    return {
      total,
      page: dto.page,
      perPage: dto.perPage,
      data: entities as any,
    };
  }

  /**
   * Retrieves a single project by its unique identifier.
   * @param projectId - Unique identifier of the project to retrieve
   * @returns Promise containing the requested project response
   */
  async getProject(
    projectId: number,
    criteria: ProjectCriteria,
    req: Request,
  ): Promise<ProjectResponseDto> {
    let selectFields =
      Utils.parseCommaSeparatedString(
        criteria.fields,
        ALLOWED_PROJECT_FIELDS,
      ) || ALLOWED_PROJECT_FIELDS;

    let entity: any = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      include: {
        details: {
          include: {
            utm: true,
            setting: true,
            appDefinition: true,
            projectData: true,
            techstack: true,
            apiDefinition: true,
          },
        },
        external: true,
        challengeEligibility: true,
        estimation: {
          include: {
            metadata: true,
          },
        },
        attachments: true,
        bookmarks: true,
        members: true,
        memberInvites: {
          where: {
            status: {
              in: ['pending', 'requested'],
            },
          },
        },
        phases: {
          include: {
            products: true,
            members: true,
          },
        },
      },
    });

    if (!entity) {
      throw new NotFoundException(`Not found project of id ${projectId}`);
    }

    // check context for project members
    if (!criteria.fields || criteria.fields.indexOf('members') > -1) {
      if (Utils.hasPermissionByReq(PERMISSION.READ_PROJECT_MEMBER, req)) {
        selectFields.push('members');
      }
    }

    // include all invites
    if (!criteria.fields || criteria.fields.indexOf('invites') > -1) {
      if (
        Utils.hasPermissionByReq(PERMISSION.READ_PROJECT_INVITE_NOT_OWN, req)
      ) {
        selectFields.push('invites');
        set(entity, 'invites', entity.memberInvites);
      } else if (
        Utils.hasPermissionByReq(PERMISSION.READ_PROJECT_INVITE_OWN, req)
      ) {
        // include only own invites
        selectFields.push('invites');
        const authUser = get(req, 'authUser');
        if (entity.memberInvites) {
          const memberInvites = entity.memberInvites.filter(
            (item) =>
              (item.userId !== null &&
                String(item.userId) === String(authUser.userId)) ||
              (item.email &&
                authUser.email &&
                item.email.toLocaleLowerCase() ===
                  authUser.email.toLocaleLowerCase()),
          );

          set(entity, 'invites', memberInvites);
        } else {
          set(entity, 'invites', []);
        }
      }
    }

    if (!criteria.fields || criteria.fields.indexOf('attachments') === -1) {
      const idx = selectFields.indexOf('attachments');

      selectFields = [...selectFields];
      selectFields.splice(idx, 1);
    }

    entity = pick(entity, selectFields) as any;

    // omit deletedAt and check attachment access permission
    entity = this.checkAttachmentPermissionAndOmitDeletedAt(entity, req);

    return entity;
  }

  /**
   * Omit deletedAt and check attachment access permission.
   * @param entity - Project entity
   * @param req - The request
   * @returns fixed project entity
   */
  private checkAttachmentPermissionAndOmitDeletedAt(entity, req: Request) {
    if (entity) {
      if (entity.members && entity.members.length > 0) {
        entity.members = entity.members.map((item) => omit(item, 'deletedAt'));
      }
      if (entity.estimation && entity.estimation.length > 0) {
        entity.estimation = entity.estimation.map((item) => {
          const fixedItem = omit(item, 'deletedAt');
          if (fixedItem.metadata) {
            fixedItem.metadata = omit(fixedItem.metadata, 'deletedAt');
          }
          return fixedItem;
        });
      }
      if (entity.invites && entity.invites.length > 0) {
        const invites = entity.invites.map((item) => omit(item, 'deletedAt'));
        set(entity, 'invites', invites);
      }
      if (entity.attachments && entity.attachments.length > 0) {
        entity.attachments = entity.attachments.filter((attachment) =>
          this.hasReadAccessToAttachment(attachment, req),
        );
        entity.attachments = entity.attachments.map((item) =>
          omit(item, 'deletedAt'),
        );
      }
    }

    return entity;
  }

  /**
   * Updates an existing project with new data.
   * @param projectId - Unique identifier of the project to update
   * @param dto - Data containing project updates
   * @param req - The request
   * @returns Promise containing the updated project response
   */
  async updateProject(
    projectId: number,
    dto: UpdateProjectDto,
    req: Request,
  ): Promise<ProjectResponseDto> {
    let updatedProject = cloneDeep(dto);

    updatedProject = omit(updatedProject, [
      'createdBy',
      'createdAt',
      'updatedBy',
      'updatedAt',
      'id',
    ]);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const entity: any = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      include: {
        details: {
          include: {
            utm: true,
            setting: true,
            appDefinition: true,
            projectData: true,
            techstack: true,
            apiDefinition: true,
          },
        },
        external: true,
        challengeEligibility: true,
        bookmarks: true,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Not found project of id ${projectId}`);
    }

    // check if user has permissions to update project status
    if (
      updatedProject.status &&
      updatedProject.status !== entity.status &&
      !Utils.hasPermissionByReq(PERMISSION.UPDATE_PROJECT_STATUS, req)
    ) {
      throw new ForbiddenException(
        'You are not allowed to update project status',
      );
    }

    if (
      updatedProject.status === PROJECT_STATUS.CANCELLED &&
      !updatedProject.cancelReason
    ) {
      throw new BadRequestException(
        'Cancel reason is required when status is cancelled',
      );
    }

    if (
      updatedProject.directProjectId &&
      !Utils.hasPermissionByReq(
        PERMISSION.MANAGE_PROJECT_DIRECT_PROJECT_ID,
        req,
      )
    ) {
      throw new BadRequestException(
        "You do not have permission to update 'directProjectId' property",
      );
    }

    if (
      updatedProject.status === PROJECT_STATUS.DRAFT &&
      entity.status !== PROJECT_STATUS.DRAFT
    ) {
      throw new BadRequestException('cannot update a project status to draft');
    }

    if (entity.status === PROJECT_STATUS.COMPLETED) {
      throw new BadRequestException(
        `cannot update a project that is in '${PROJECT_STATUS.COMPLETED}' state`,
      );
    }

    await this.checkProjectType(updatedProject.type);

    if (updatedProject.external) {
      if (entity.external) {
        updatedProject.external = {
          update: {
            ...updatedProject.external,
            updatedBy: authUser.userId,
          },
        };
      } else {
        updatedProject.external = {
          create: {
            ...updatedProject.external,
            createdBy: authUser.userId,
          },
        };
      }
    }

    if (
      updatedProject.details &&
      Object.keys(updatedProject.details).length > 0
    ) {
      if (updatedProject.details.utm) {
        if (entity.details?.utm) {
          updatedProject.details.utm = {
            update: {
              ...updatedProject.details.utm,
              updatedBy: authUser.userId,
            },
          };
        } else {
          updatedProject.details.utm = {
            create: {
              ...updatedProject.details.utm,
              createdBy: authUser.userId,
            },
          };
        }
      }

      if (updatedProject.details.appDefinition) {
        if (entity.details?.appDefinition) {
          updatedProject.details.appDefinition = {
            update: {
              ...updatedProject.details.appDefinition,
              updatedBy: authUser.userId,
            },
          };
        } else {
          updatedProject.details.appDefinition = {
            create: {
              ...updatedProject.details.appDefinition,
              createdBy: authUser.userId,
            },
          };
        }
      }

      if (updatedProject.details.projectData) {
        if (entity.details?.projectData) {
          updatedProject.details.projectData = {
            update: {
              ...updatedProject.details.projectData,
              updatedBy: authUser.userId,
            },
          };
        } else {
          updatedProject.details.projectData = {
            create: {
              ...updatedProject.details.projectData,
              createdBy: authUser.userId,
            },
          };
        }
      }

      if (updatedProject.details.techstack) {
        if (entity.details?.techstack) {
          updatedProject.details.techstack = {
            update: {
              ...updatedProject.details.techstack,
              updatedBy: authUser.userId,
            },
          };
        } else {
          updatedProject.details.techstack = {
            create: {
              ...updatedProject.details.techstack,
              createdBy: authUser.userId,
            },
          };
        }
      }

      if (updatedProject.details.apiDefinition) {
        if (entity.details?.apiDefinition) {
          updatedProject.details.apiDefinition = {
            update: {
              ...updatedProject.details.apiDefinition,
              updatedBy: authUser.userId,
            },
          };
        } else {
          updatedProject.details.apiDefinition = {
            create: {
              ...updatedProject.details.apiDefinition,
              createdBy: authUser.userId,
            },
          };
        }
      }

      if (entity.details) {
        updatedProject.details = {
          update: {
            ...updatedProject.details,
            updatedBy: authUser.userId,
          },
        };
      } else {
        updatedProject.details = {
          create: {
            ...updatedProject.details,
            createdBy: authUser.userId,
          },
        };
      }
    } else {
      delete updatedProject.details;
    }

    if (updatedProject.bookmarks) {
      const bookmarksQuery: any = {};
      if (entity.bookmarks) {
        bookmarksQuery.deleteMany = {};
      }
      bookmarksQuery.create = updatedProject.bookmarks.map((item) => ({
        ...item,
        createdBy: authUser.userId,
      }));
      updatedProject.bookmarks = bookmarksQuery;
    }

    if (updatedProject.challengeEligibility) {
      const challengeEligibilityQuery: any = {};
      if (entity.bookmarks) {
        challengeEligibilityQuery.deleteMany = {};
      }
      challengeEligibilityQuery.create =
        updatedProject.challengeEligibility.map((item) => ({
          ...item,
          createdBy: authUser.userId,
        }));
      updatedProject.challengeEligibility = challengeEligibilityQuery;
    }

    let result = await this.prisma.$transaction(async (tx) => {
      this.logger.debug('updating project with nested items');
      const updatedEntity = await tx.project.update({
        where: {
          id: projectId,
        },
        data: updatedProject,
        include: {
          details: {
            include: {
              utm: true,
              setting: true,
              appDefinition: true,
              projectData: true,
              techstack: true,
              apiDefinition: true,
            },
          },
          external: true,
          challengeEligibility: true,
          attachments: true,
          bookmarks: true,
          members: true,
        },
      });
      this.logger.debug(
        `project updated with data: ${JSON.stringify(updatedEntity)})`,
      );

      // we only want to have project history when project status is updated
      if (updatedProject.status && updatedProject.status !== entity.status) {
        this.logger.debug('creating project history');
        await tx.projectHistory.create({
          data: {
            projectId: entity.id,
            status: updatedProject.status,
            cancelReason: updatedProject.cancelReason,
            updatedBy: authUser.userId,
          },
        });
        this.logger.debug(`project history created for project ${entity.id}`);
      }

      return updatedEntity;
    });

    // omit deletedAt and check attachment access permission
    result = this.checkAttachmentPermissionAndOmitDeletedAt(result, req);

    // emit event
    this.logger.debug(`Sending event to Kafka bus for project ${result.id}`);
    const payload = {
      original: entity,
      updated: assign({ resource: RESOURCES.PROJECT }, result),
    };
    await this.eventBus.postBusEvent(BUS_API_EVENT.PROJECT_UPDATED, payload);
    await this.eventBus.postBusEvent(
      EVENT.ROUTING_KEY.PROJECT_UPDATED,
      payload,
    );

    return result as any;
  }

  /**
   * Deletes a project from the system.
   * @param projectId - Unique identifier of the project to delete
   * @param req - The request
   * @returns Promise that resolves when deletion is complete
   */
  async deleteProject(projectId: number, req: Request): Promise<void> {
    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const entity = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Not found project of id ${projectId}`);
    }

    this.logger.debug(`deleting project with id: ${projectId}`);
    await this.prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: authUser.userId,
      },
    });

    // emit event
    this.logger.debug(`Sending event to Kafka bus for project ${projectId}`);
    const payload = {
      updated: assign({ resource: RESOURCES.PROJECT }, { id: projectId }),
    };
    await this.eventBus.postBusEvent(BUS_API_EVENT.PROJECT_DELETED, payload);
    await this.eventBus.postBusEvent(
      EVENT.ROUTING_KEY.PROJECT_DELETED,
      payload,
    );
  }

  /**
   * Check if request from the user has permission to READ attachment
   *
   * @param {Object}          attachment attachment
   * @param {express.Request} req        request
   *
   * @returns {Boolean} true if has permission
   */
  private hasReadAccessToAttachment(attachment, req) {
    if (!attachment) {
      return false;
    }

    const isOwnAttachment = attachment.createdBy === req.authUser.userId;
    const isAllowedAttachment =
      attachment.allowedUsers === null ||
      includes(attachment.allowedUsers, req.authUser.userId);

    if (
      Utils.hasPermissionByReq(
        PERMISSION.READ_PROJECT_ATTACHMENT_OWN_OR_ALLOWED,
        req,
      ) &&
      (isOwnAttachment || isAllowedAttachment)
    ) {
      return true;
    }

    if (
      Utils.hasPermissionByReq(
        PERMISSION.READ_PROJECT_ATTACHMENT_NOT_OWN_AND_NOT_ALLOWED,
        req,
      ) &&
      !isOwnAttachment &&
      !isAllowedAttachment
    ) {
      return true;
    }

    return false;
  }
}
