/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import * as moment from 'moment';
import { PrismaService } from 'src/shared/services/prisma.service';
import { EventBusService } from 'src/shared/services/event-bus.service';
import { UtilService } from 'src/shared/services/util.service';
import { AppConfig } from '../../../config/config';
import {
  CreateProjectMemberDto,
  ProjectMemberResponseDto,
  QueryProjectMemberDto,
  UpdateProjectMemberDto,
} from './project-member.dto';
import { FieldsQueryDto } from '../common/common.dto';
import { JwtUser } from 'src/auth/auth.dto';
import { PERMISSION } from 'src/auth/constants';
import {
  EVENT,
  PROJECT_MEMBER_ROLE,
  PROJECT_TO_TOPCODER_ROLES_MATRIX,
  RESOURCES,
  COPILOT_REQUEST_STATUS,
  COPILOT_OPPORTUNITY_STATUS,
  COPILOT_APPLICATION_STATUS,
  CONNECT_NOTIFICATION_EVENT,
  TEMPLATE_IDS,
} from 'src/shared/constants';
import Utils from 'src/shared/utils';
import { pick, omit, assign, cloneDeep, isUndefined } from 'lodash';

export const ALLOWED_PROJECT_MEMBER_FIELDS = [
  'id',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'deletedBy',
  'userId',
  'role',
  'isPrimary',
  'handle',
  'email',
  'firstName',
  'lastName',
  'photoURL',
  'workingHourStart',
  'workingHourEnd',
  'timeZone',
];

/**
 * Service for managing project members and their associations with projects.
 * Handles CRUD operations for project members including creation, retrieval,
 * updating, and deletion of member records.
 */
@Injectable()
export class ProjectMemberService {
  private readonly logger = new Logger(ProjectMemberService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly utilService: UtilService,
  ) {}

  /**
   * Creates a new project member association.
   * @param req - The request
   * @param projectId - ID of the project to associate with
   * @param dto - Data transfer object containing member details
   * @param query - Optional fields query for response shaping
   * @returns Promise resolving to the created project member response
   */
  async create(
    req: Request,
    projectId: number,
    dto: CreateProjectMemberDto,
    query: FieldsQueryDto,
  ): Promise<ProjectMemberResponseDto> {
    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const selectFields =
      Utils.parseCommaSeparatedString(
        query.fields,
        ALLOWED_PROJECT_MEMBER_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_FIELDS;

    // by default, we would add the current user as a member
    let addUserId: any = authUser.userId;
    let addUser = authUser as any;

    // if `userId` is provided in the request body then we should add this user as a member
    if (dto.userId && dto.userId !== authUser.userId) {
      addUserId = dto.userId;

      // check if current user has permissions to add other users
      if (
        !Utils.hasPermissionByReq(PERMISSION.CREATE_PROJECT_MEMBER_NOT_OWN, req)
      ) {
        throw new ForbiddenException(
          "You don't have permissions to add other users as a project member.",
        );
      }

      // if we are adding another user, we have to get that user roles for checking permissions
      try {
        const addUserRoles = await this.utilService.getUserRoles(addUserId);

        addUser = {
          roles: addUserRoles,
        };
      } catch (e) {
        throw new InternalServerErrorException(
          `Cannot get user roles: "${e.message}".`,
        );
      }
    }

    const targetRole = dto.role || Utils.getDefaultProjectRole(addUser);

    if (!targetRole) {
      throw new InternalServerErrorException(
        'Cannot automatically detect role for a new member.',
      );
    }

    if (
      !Utils.matchPermissionRule(
        { topcoderRoles: PROJECT_TO_TOPCODER_ROLES_MATRIX[targetRole] },
        addUser,
        undefined,
      )
    ) {
      throw new UnauthorizedException(
        `User doesn't have required roles to be added to the project as "${targetRole}".`,
      );
    }

    const userDetails = await this.utilService.getMemberDetailsByUserIds([
      addUserId,
    ]);
    if (!userDetails || !userDetails[0]) {
      throw new BadRequestException(
        `Member with id ${addUserId} does not exist`,
      );
    }
    const userDetail = userDetails[0];

    const member = {
      projectId,
      role: targetRole,
      userId: addUserId,
      createdBy: authUser.userId,
      updatedBy: authUser.userId,
      handle: userDetail.handle,
      email: userDetail.email,
      firstName: userDetail.firstName,
      lastName: userDetail.lastName,
    };

    // let newMember;
    let newMember = await this.prisma.$transaction(async (tx) => {
      // Kafka event is emitted inside `addUserToProject`
      return await this.utilService.addUserToProject(tx, projectId, member);
    });

    const memberDetails = await this.utilService.getObjectsWithMemberDetails(
      [newMember],
      selectFields,
      req,
    );

    newMember = pick(memberDetails[0], selectFields) as any;

    return newMember;
  }

  /**
   * Searches for project members based on query parameters.
   * @param projectId - ID of the project to search within
   * @param dto - Query parameters for filtering/searching members
   * @returns Promise resolving to an array of matching project members
   */
  async search(
    projectId: number,
    dto: QueryProjectMemberDto,
    req: Request,
  ): Promise<ProjectMemberResponseDto[]> {
    await this.checkProjectExist(projectId);

    const selectFields =
      Utils.parseCommaSeparatedString(
        dto.fields,
        ALLOWED_PROJECT_MEMBER_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_FIELDS;

    const filterParam: any = {
      projectId,
      deletedBy: null,
    };

    if (dto.role) {
      filterParam.role = dto.role;
    }

    let entities = await this.prisma.projectMember.findMany({
      where: filterParam,
      omit: {
        deletedAt: true,
        deletedBy: true,
      },
      orderBy: { id: 'asc' },
    });

    entities = await this.utilService.getObjectsWithMemberDetails(
      entities,
      selectFields,
      req,
    );

    entities = entities.map((entity) => {
      const entityItem = pick(entity, selectFields) as any;
      return entityItem;
    });

    return entities as any;
  }

  /**
   * Retrieves a specific project member by their ID.
   * @param projectId - ID of the associated project
   * @param id - ID of the project member to retrieve
   * @param query - Optional fields query for response shaping
   * @returns Promise resolving to the requested project member
   */
  async getMember(
    projectId: number,
    id: number,
    dto: FieldsQueryDto,
    req: Request,
  ): Promise<ProjectMemberResponseDto> {
    const selectFields =
      Utils.parseCommaSeparatedString(
        dto.fields,
        ALLOWED_PROJECT_MEMBER_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_FIELDS;

    await this.checkProjectExist(projectId);

    const entity = await this.prisma.projectMember.findUnique({
      where: {
        id,
        projectId,
      },
      omit: {
        deletedAt: true,
        deletedBy: true,
      },
    });

    if (!entity) {
      throw new NotFoundException(
        `member not found for project id ${projectId}, id ${id}`,
      );
    }

    const memberDetails = await this.utilService.getObjectsWithMemberDetails(
      [entity],
      selectFields,
      req,
    );

    const memberDetail = pick(memberDetails[0], selectFields) as any;

    return memberDetail;
  }

  /**
   * Updates an existing project member's details.
   * @param authUser - Authenticated user making the request
   * @param projectId - ID of the associated project
   * @param id - ID of the project member to update
   * @param dto - Data transfer object containing updated member details
   * @param query - Optional fields query for response shaping
   * @returns Promise resolving to the updated project member
   */
  async updateMember(
    projectId: number,
    id: number,
    dto: UpdateProjectMemberDto,
    query: FieldsQueryDto,
    req: Request,
  ): Promise<ProjectMemberResponseDto> {
    const action = dto.action;
    const updatedProps = pick(dto, ['isPrimary', 'role']);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const selectFields =
      Utils.parseCommaSeparatedString(
        query.fields,
        ALLOWED_PROJECT_MEMBER_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_FIELDS;

    await this.checkProjectExist(projectId);

    return await this.prisma.$transaction(
      async (tx) => {
        const entity = await tx.projectMember.findUnique({
          where: {
            id,
            projectId,
          },
        });

        if (!entity) {
          throw new NotFoundException(
            `member not found for project id ${projectId}, id ${id}`,
          );
        }

        let projectMember = entity;
        const previousValue = cloneDeep(projectMember);
        assign(projectMember, updatedProps);
        projectMember.updatedBy = authUser.userId as any;
        await tx.projectMember.update({
          where: {
            id: projectMember.id,
          },
          data: omit(projectMember, 'id'),
        });

        if (
          previousValue.userId !== authUser.userId &&
          previousValue.role !== PROJECT_MEMBER_ROLE.CUSTOMER &&
          !Utils.hasPermissionByReq(
            PERMISSION.UPDATE_PROJECT_MEMBER_NON_CUSTOMER,
            req,
          )
        ) {
          throw new ForbiddenException(
            "You don't have permission to update a non-customer member.",
          );
        }

        this.logger.debug(`updated props ${JSON.stringify(updatedProps)}`);
        this.logger.debug(`previous values ${JSON.stringify(previousValue)}`);

        // no updates if no change
        if (
          (updatedProps.role === previousValue.role ||
            action === 'complete-copilot-requests') &&
          (isUndefined(updatedProps.isPrimary) ||
            updatedProps.isPrimary === previousValue.isPrimary)
        ) {
          await this.completeAllCopilotRequests(tx, projectId, entity);
        }

        const roles = await this.utilService.getUserRoles(projectMember.userId);

        if (
          previousValue.role !== updatedProps.role &&
          !Utils.matchPermissionRule(
            {
              topcoderRoles:
                PROJECT_TO_TOPCODER_ROLES_MATRIX[updatedProps.role],
            },
            { roles },
            null,
          )
        ) {
          throw new UnauthorizedException(
            `User doesn't have required Topcoder roles to have project role "${updatedProps.role}".`,
          );
        }

        if (updatedProps.isPrimary) {
          // if set as primary, other users with same role should no longer be primary
          await tx.projectMember.updateMany({
            where: {
              projectId,
              isPrimary: true,
              role: updatedProps.role,
              id: {
                not: projectMember.id,
              },
            },
            data: {
              isPrimary: false,
              updatedBy: authUser.userId,
            },
          });
        }

        if (
          ['observer', 'customer'].includes(previousValue.role) &&
          ['copilot', 'manager'].includes(updatedProps.role)
        ) {
          await this.completeAllCopilotRequests(tx, projectId, projectMember);
        }

        const memberDetails =
          await this.utilService.getObjectsWithMemberDetails(
            [projectMember],
            selectFields,
            req,
          );

        projectMember = pick(memberDetails[0], selectFields) as any;

        // emit the event
        const payload = {
          resource: assign(
            { resource: RESOURCES.PROJECT_MEMBER },
            projectMember,
          ),
          originalResource: assign(
            { resource: RESOURCES.PROJECT_MEMBER },
            previousValue,
          ),
        };

        await this.eventBus.postBusEvent(
          EVENT.ROUTING_KEY.PROJECT_MEMBER_UPDATED,
          payload,
        );
        this.logger.debug('updated project member', projectMember);

        return projectMember as any;
      },
      {
        timeout: AppConfig.prismaTransactionTimeout,
      },
    );
  }

  /**
   * Removes a member from a project.
   * @param projectId - ID of the associated project
   * @param id - ID of the project member to remove
   * @returns Promise that resolves when the member is successfully removed
   */
  async deleteMember(
    projectId: number,
    id: number,
    req: Request,
  ): Promise<void> {
    await this.checkProjectExist(projectId);

    const member: any = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        id,
        deletedBy: null,
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Member not found for project id ${projectId}, member id ${id}`,
      );
    }

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const isOwnMember = member.userId === authUser.userId;

    if (
      !isOwnMember &&
      member.role !== PROJECT_MEMBER_ROLE.CUSTOMER &&
      member.role !== PROJECT_MEMBER_ROLE.COPILOT &&
      !Utils.hasPermissionByReq(PERMISSION.DELETE_PROJECT_MEMBER_TOPCODER, req)
    ) {
      throw new ForbiddenException(
        "You don't have permissions to delete other members from Topcoder Team.",
      );
    } else if (
      !isOwnMember &&
      member.role === PROJECT_MEMBER_ROLE.CUSTOMER &&
      !Utils.hasPermissionByReq(PERMISSION.DELETE_PROJECT_MEMBER_CUSTOMER, req)
    ) {
      throw new ForbiddenException(
        'You don\'t have permissions to delete other members with "customer" role.',
      );
    } else if (
      !isOwnMember &&
      member.role === PROJECT_MEMBER_ROLE.COPILOT &&
      !Utils.hasPermissionByReq(PERMISSION.DELETE_PROJECT_MEMBER_COPILOT, req)
    ) {
      throw new ForbiddenException(
        'You don\'t have permissions to delete other members with "copilot" role.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const entity = await tx.projectMember.update({
        where: {
          id: member.id,
        },
        data: {
          deletedBy: authUser.userId,
          deletedAt: new Date(),
        },
      });

      // if primary co-pilot is removed promote the next co-pilot to primary #43
      if (member.role === PROJECT_MEMBER_ROLE.COPILOT && member.isPrimary) {
        // find the next copilot
        const nextMember = await tx.projectMember.findFirst({
          where: {
            projectId,
            role: PROJECT_MEMBER_ROLE.COPILOT as any,
            deletedBy: null,
          },
          orderBy: { createdAt: 'asc' },
        });

        if (nextMember) {
          await tx.projectMember.update({
            where: {
              id: nextMember.id,
            },
            data: {
              isPrimary: true,
            },
          });
        }
      }

      // emit the event
      const payload = assign({ resource: RESOURCES.PROJECT_MEMBER }, entity);
      await this.eventBus.postBusEvent(
        EVENT.ROUTING_KEY.PROJECT_MEMBER_REMOVED,
        payload,
      );

      return entity;
    });
  }

  /**
   * Check project with id whether exist
   * @param projectId - ID of the associated project
   */
  private async checkProjectExist(projectId: number) {
    const entity: any = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!entity) {
      throw new NotFoundException(`Not found project of id ${projectId}`);
    }
  }

  /**
   * Complete all copilot requests
   *
   * @param {Object}   tx        The prisma transaction
   * @param {Number}   projectId The project id
   * @param {Object}   member    The member
   */
  private async completeAllCopilotRequests(tx, projectId, member) {
    const allCopilotRequests = await tx.copilotRequest.findMany({
      where: {
        projectId,
        status: {
          in: [
            COPILOT_REQUEST_STATUS.APPROVED,
            COPILOT_REQUEST_STATUS.NEW,
            COPILOT_REQUEST_STATUS.SEEKING,
          ],
        },
      },
    });

    this.logger.debug(
      `all copilot requests ${JSON.stringify(allCopilotRequests)}`,
    );

    const allCopilotRequestIds = allCopilotRequests.map((item) => item.id);

    await tx.copilotRequest.updateMany({
      data: {
        status: COPILOT_REQUEST_STATUS.FULFILLED,
      },
      where: {
        id: {
          in: allCopilotRequestIds,
        },
      },
    });

    this.logger.debug(`updated all copilot requests`);

    const copilotOpportunites = await tx.copilotOpportunity.findMany({
      where: {
        id: {
          in: allCopilotRequestIds,
        },
      },
    });

    this.logger.debug(
      `all copilot opportunities ${JSON.stringify(copilotOpportunites)}`,
    );

    const copilotOpportunityIds = copilotOpportunites.map((item) => item.id);

    await tx.copilotOpportunity.updateMany({
      data: {
        status: COPILOT_OPPORTUNITY_STATUS.COMPLETED,
      },
      where: {
        id: {
          in: copilotOpportunityIds,
        },
      },
    });

    this.logger.debug(`updated all copilot opportunities`);

    const allCopilotApplications = await tx.copilotApplication.findMany({
      where: {
        opportunityId: {
          in: copilotOpportunityIds,
        },
      },
    });

    const memberApplication = allCopilotApplications.find(
      (app) => String(app.userId) === String(member.userId),
    );
    const applicationsWithoutMemberApplication = allCopilotApplications.filter(
      (app) => String(app.userId) !== String(member.userId),
    );

    this.logger.debug(
      `all copilot applications ${JSON.stringify(allCopilotApplications)}`,
    );

    await tx.CopilotApplication.updateMany({
      data: {
        status: COPILOT_APPLICATION_STATUS.CANCELED,
      },
      where: {
        id: {
          in: applicationsWithoutMemberApplication.map((item) => item.id),
        },
      },
    });

    // If the invited member
    if (memberApplication) {
      await tx.CopilotApplication.update({
        data: {
          status: COPILOT_APPLICATION_STATUS.ACCEPTED,
        },
        where: {
          id: memberApplication.id,
        },
      });
    }

    this.logger.debug(`updated all copilot applications`);

    const memberDetails = await this.utilService.getMemberDetailsByUserIds([
      member.userId,
    ]);
    const memberDetail = memberDetails[0];

    this.logger.debug(`member details: ${JSON.stringify(memberDetail)}`);

    const emailEventType = CONNECT_NOTIFICATION_EVENT.EXTERNAL_ACTION_EMAIL;
    allCopilotRequests.forEach(async (request) => {
      const requestData = request.data;

      this.logger.debug(`Copilot request data: ${JSON.stringify(requestData)}`);
      const opportunity = copilotOpportunites.find(
        (item) => item.copilotRequestId === request.id,
      );

      this.logger.debug(`Opportunity: ${JSON.stringify(opportunity)}`);
      const payload = {
        data: {
          opportunity_details_url: `${AppConfig.copilotPortalUrl}/opportunity/${opportunity?.id}`,
          work_manager_url: AppConfig.workManagerUrl,
          opportunity_type: Utils.getCopilotTypeLabel(requestData.projectType),
          opportunity_title: requestData.opportunityTitle,
          start_date: requestData.startDate
            ? moment.utc(requestData.startDate).format('DD-MM-YYYY')
            : '',
          user_name: member ? member.handle : '',
        },
        sendgrid_template_id: TEMPLATE_IDS.COPILOT_ALREADY_PART_OF_PROJECT,
        recipients: [member.email],
        version: 'v3',
      };
      await this.eventBus.postBusEvent(emailEventType, payload);

      this.logger.debug(`Sent email to ${member.email}`);
    });
  }
}
