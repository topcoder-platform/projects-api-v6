/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtUser } from 'src/auth/auth.dto';
import { Request } from 'express';
import { PrismaService } from 'src/shared/services/prisma.service';
import { EventBusService } from 'src/shared/services/event-bus.service';
import { UtilService } from 'src/shared/services/util.service';
import {
  CreateInviteDto,
  CreateInviteResponseDto,
  InviteResponseDto,
  UpdateInviteDto,
} from './project-member-invite.dto';
import { FieldsQueryDto } from '../common/common.dto';
import { PERMISSION, PermissionRule } from 'src/auth/constants';
import Utils from 'src/shared/utils';
import {
  EVENT,
  INVITE_STATUS,
  PROJECT_MEMBER_ROLE,
  PROJECT_TO_TOPCODER_ROLES_MATRIX,
  MAX_PARALLEL_REQUEST_QTY,
  RESOURCES,
  CONNECT_NOTIFICATION_EVENT,
  TEMPLATE_IDS,
  COPILOT_OPPORTUNITY_STATUS,
  COPILOT_APPLICATION_STATUS,
  COPILOT_REQUEST_STATUS,
  INVITE_SOURCE,
  USER_ROLE,
} from 'src/shared/constants';
import {
  concat,
  pick,
  map,
  includes,
  assign,
  cloneDeep,
  find,
  difference,
  filter,
  remove,
  some,
  forEach,
  zip,
  toLower,
} from 'lodash';
import { AppConfig } from 'config/config';

export const ALLOWED_PROJECT_MEMBER_INVITE_FIELDS = [
  'id',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'deletedBy',
  'userId',
  'email',
  'applicationId',
  'role',
  'status',
  'handle',
  'photoURL',
  'workingHourStart',
  'workingHourEnd',
  'timeZone',
];

/**
 * Service for managing project member invitations.
 * Handles creation, retrieval, updating, and deletion of project member invites.
 */
@Injectable()
export class ProjectMemberInviteService {
  private readonly logger = new Logger(ProjectMemberInviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly utilService: UtilService,
  ) {}

  /**
   * Creates a new project member invitation.
   * @param authUser - Authenticated user creating the invitation
   * @param projectId - ID of the project to invite to
   * @param dto - Data transfer object containing invite details
   * @param query - Optional fields query for response shaping
   * @returns Promise resolving to the created invite response
   */
  async createInvite(
    projectId: number,
    dto: CreateInviteDto,
    query: FieldsQueryDto,
    req: Request,
  ): Promise<CreateInviteResponseDto> {
    await this.checkProjectExist(projectId);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const selectFields =
      Utils.parseCommaSeparatedString(
        query.fields,
        ALLOWED_PROJECT_MEMBER_INVITE_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_INVITE_FIELDS;

    if (!dto.handles && !dto.emails) {
      throw new BadRequestException('Either handles or emails are required');
    }

    if (
      // if cannot invite non-customer user
      dto.role !== PROJECT_MEMBER_ROLE.CUSTOMER &&
      !Utils.hasPermissionByReq(
        PERMISSION.CREATE_PROJECT_INVITE_TOPCODER,
        req,
      ) &&
      !(
        // and if cannot invite copilot directly
        (
          dto.role === PROJECT_MEMBER_ROLE.COPILOT &&
          Utils.hasPermissionByReq(
            PERMISSION.CREATE_PROJECT_INVITE_COPILOT,
            req,
          )
        )
      )
    ) {
      throw new ForbiddenException(
        `You are not allowed to invite user as ${dto.role}.`,
      );
    }

    const foundUsers = await this.utilService.getMemberDetailsByHandles(
      dto.handles,
    );

    let inviteUsers: any = [];
    let failed: any = [];
    if (dto.handles) {
      const lowerCaseHandles = dto.handles.map((handle) =>
        handle.toLowerCase(),
      );
      inviteUsers = foundUsers.filter((foundUser) =>
        includes(lowerCaseHandles, foundUser.handleLower),
      );
    }

    // check user handle exists in returned result
    const errorMessageHandleNotExist =
      "We couldn't find a user with the provided username. " +
      'Please ensure that the username is accurate, including its letter casing. ' +
      "If you're still having trouble, double-check the spelling and try again.";
    if (!!dto.handles && dto.handles.length > 0) {
      const lowerCaseHandles = dto.handles.map((handle) =>
        handle.toLowerCase(),
      );
      const existentHandles = map(inviteUsers, 'handleLower');
      failed = concat(
        failed,
        map(difference(lowerCaseHandles, existentHandles), (handle) =>
          assign(
            {},
            {
              handle,
              message: errorMessageHandleNotExist,
            },
          ),
        ),
      );
    }

    this.logger.debug(`Invite users: ${JSON.stringify(inviteUsers)}`);
    let inviteUserIds = map(inviteUsers, 'userId');
    this.logger.debug(`Invite user ids: ${JSON.stringify(inviteUserIds)}`);
    const promises: any = [];
    const errorMessageForAlreadyMemberUser =
      'User with such handle is already a member of the team.';

    let members: any = [];
    if (inviteUserIds) {
      members = await this.prisma.projectMember.findMany({
        where: {
          projectId,
        },
      });

      const projectMembers = filter(members, (m) => {
        return inviteUserIds.includes(m.userId);
      });

      this.logger.debug(
        `Existing Project Members: ${JSON.stringify(projectMembers)}`,
      );

      const existingProjectMembersMap = projectMembers.reduce(
        (acc, current) => {
          return Object.assign({}, acc, {
            ['' + authUser.userId]: current,
          });
        },
        {},
      );

      this.logger.debug(
        `Existing Project Members Map: ${JSON.stringify(existingProjectMembersMap)}`,
      );

      remove(inviteUserIds, (u) =>
        some(members, (m) => {
          const isPresent = m.userId === u;
          if (isPresent) {
            failed.push(
              assign(
                {},
                {
                  handle: this.getUserHandleById(m.userId, inviteUsers),
                  message: errorMessageForAlreadyMemberUser,
                  error: 'ALREADY_MEMBER',
                  role: existingProjectMembersMap[m.userId].role,
                },
              ),
            );
          }
          return isPresent;
        }),
      );

      // for each user invited by `handle` (userId) we have to load they Topcoder Roles,
      // so we can check if such a user can be invited with desired Project Role
      // for customers we don't check it to avoid extra call, as any Topcoder user can be invited as customer
      if (dto.role !== PROJECT_MEMBER_ROLE.CUSTOMER) {
        forEach(inviteUserIds, (userId) => {
          this.logger.log(userId);
          promises.push(this.utilService.getUserRoles(userId));
        });
      }
    }

    if (dto.emails) {
      // email invites can only be used for CUSTOMER role
      if (dto.role !== PROJECT_MEMBER_ROLE.CUSTOMER) {
        const message = `Emails can only be used for ${PROJECT_MEMBER_ROLE.CUSTOMER}`;
        failed = concat(
          failed,
          map(dto.emails, (email) => assign({}, { email, message })),
        );
        delete dto.emails;
      }
    }

    if (promises.length === 0) {
      promises.push(Promise.resolve());
    }

    this.logger.debug(`All promises: ${JSON.stringify(promises)}`);
    let values: any = await Promise.all(promises).then(async (rolesList) => {
      this.logger.debug(`RoleList: ${JSON.stringify(rolesList)}`);
      if (inviteUserIds && dto.role !== PROJECT_MEMBER_ROLE.CUSTOMER) {
        this.logger.debug(`Checking if users: ${JSON.stringify(inviteUserIds)}
          are allowed to be invited with desired Project Role.`);
        const forbidUserList: any = [];
        zip(inviteUserIds, rolesList).forEach((data) => {
          const [userId, roles] = data;

          if (roles) {
            this.logger.debug(
              `Got user (id: ${userId}) Topcoder roles: ${roles.join(', ')}.`,
            );

            if (
              !Utils.hasPermission(
                new PermissionRule({
                  topcoderRoles: PROJECT_TO_TOPCODER_ROLES_MATRIX[dto.role],
                }),
                { roles },
                null,
              )
            ) {
              forbidUserList.push(userId);
            }
          } else {
            this.logger.debug(
              `Didn't get any Topcoder roles for user (id: ${userId}).`,
            );
            forbidUserList.push(userId);
          }
        });
        if (forbidUserList.length > 0) {
          const message = `cannot be invited with a "${dto.role}" role to the project`;
          failed = concat(
            failed,
            map(forbidUserList, (id) =>
              assign(
                {},
                { handle: this.getUserHandleById(id, inviteUsers), message },
              ),
            ),
          );
          this.logger.debug(
            `Users with id(s) ${forbidUserList.join(', ')} ${message}`,
          );
          inviteUserIds = filter(
            inviteUserIds,
            (userId) => !includes(forbidUserList, userId),
          );
        }
      }
      const invites = await this.prisma.projectMemberInvite.findMany({
        where: {
          projectId,
          status: 'pending',
        },
      });

      const data = {
        projectId,
        role: dto.role,
        // invite copilots directly if user has permissions
        status:
          dto.role !== PROJECT_MEMBER_ROLE.COPILOT ||
          Utils.hasPermissionByReq(
            PERMISSION.CREATE_PROJECT_INVITE_COPILOT,
            req,
          )
            ? INVITE_STATUS.PENDING
            : INVITE_STATUS.REQUESTED,
        createdBy: authUser.userId,
        updatedBy: authUser.userId,
      };
      this.logger.debug('Creating invites');

      return this.prisma.$transaction(
        async (tx) => {
          const promiseArray: any = await this.buildCreateInvitePromises(
            dto.emails,
            inviteUserIds,
            invites,
            data,
            failed,
            members,
            inviteUsers,
            tx,
          );

          const values = await Promise.all(promiseArray);

          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          values.forEach(async (v: any) => {
            // emit the event
            const payload = assign(
              { resource: RESOURCES.PROJECT_MEMBER_INVITE },
              Object.assign({}, v, { source: 'work_manager' }),
            );
            await this.eventBus.postBusEvent(
              EVENT.ROUTING_KEY.PROJECT_MEMBER_INVITE_CREATED,
              payload,
            );

            this.logger.debug(`V: ${JSON.stringify(v)}`);
            // send email invite (async)
            if (v.email && !v.userId && v.status === INVITE_STATUS.PENDING) {
              await this.sendInviteEmail(authUser, projectId, v);
            }
          });

          return values;
        },
        {
          timeout: AppConfig.prismaTransactionTimeout,
        },
      );
    });

    // populate successful invites with user details if required
    values = await this.utilService.getObjectsWithMemberDetails(
      values,
      selectFields,
      req,
    );

    values = values.map((entity) => {
      const entityItem = pick(entity, selectFields) as any;
      return entityItem;
    });

    const response = assign(
      {},
      { success: Utils.postProcessInvites('$[*]', values, req) },
    );

    return {
      success: [response],
      failed,
    };
  }

  /**
   * Helper method to build promises for creating new invites in DB
   *
   * @param {Array} inviteEmails  invite.emails
   * @param {Array} inviteUserIds filtered invite.userIds
   * @param {Array}  invites existent invites from DB
   * @param {Object} data    template for new invites to be put in DB
   * @param {Array}  failed  failed invites error message
   * @param {Array} members  already members of the project
   * @param {Array} inviteUsers users retrieved by invite.handles
   * @param {Object} tx  the prisma transaction
   * @returns {Promise<Promise[]>} list of promises
   */
  private async buildCreateInvitePromises(
    inviteEmails,
    inviteUserIds,
    invites,
    data,
    failed,
    members,
    inviteUsers,
    tx,
  ) {
    const invitePromises: any = [];

    if (inviteUserIds) {
      // remove invites for users that are invited already
      const errMessageForAlreadyInvitedUsers =
        'User with such handle is already invited to this project.';
      remove(inviteUserIds, (u) =>
        some(invites, (i) => {
          const isPresent = i.userId === u;
          if (isPresent) {
            failed.push(
              assign(
                {},
                {
                  handle: this.getUserHandleById(u, inviteUsers),
                  message: errMessageForAlreadyInvitedUsers,
                },
              ),
            );
          }
          return isPresent;
        }),
      );
      inviteUserIds.forEach((userId) => {
        const dataNew = cloneDeep(data);

        dataNew.userId = userId;

        invitePromises.push(
          tx.projectMemberInvite.create({
            data: dataNew,
          }),
        );
      });
    }

    if (inviteEmails) {
      try {
        // if for some emails there are already existent users, we will invite them by userId,
        // to avoid sending them registration email
        const foundUsers = await this.utilService.lookupMultipleUserEmails(
          inviteEmails,
          MAX_PARALLEL_REQUEST_QTY,
        );

        // we have to filter emails returned by the Identity Service so we only invite the users
        // whom we are inviting, because Identity Service could possibly (maybe) return
        // users with emails whom we didn't search for
        const existentUsers = foundUsers.filter((foundUser) =>
          includes(inviteEmails, foundUser.email),
        );

        // existent user we will invite by userId and email
        const existentUsersWithNumberId = existentUsers.map((user) => {
          const userWithNumberId = cloneDeep(user);

          userWithNumberId.id = parseInt(user.id, 10);

          return userWithNumberId;
        });
        // non-existent users we will invite them by email only
        const nonExistentUserEmails = inviteEmails.filter(
          (inviteEmail) =>
            !find(existentUsers, (existentUser) =>
              this.compareEmail(existentUser.email, inviteEmail, {
                UNIQUE_GMAIL_VALIDATION: false,
              }),
            ),
        );

        // remove users that are already member of the team
        const errMessageForAlreadyMemberUsers =
          'User with such email is already a member of the team.';

        remove(existentUsersWithNumberId, (user) =>
          some(members, (m) => {
            const isPresent = m.userId === user.id;
            if (isPresent) {
              failed.push(
                assign(
                  {},
                  {
                    email: user.email,
                    message: errMessageForAlreadyMemberUsers,
                  },
                ),
              );
            }
            return isPresent;
          }),
        );

        // remove invites for users that are invited already
        const errMessageForAlreadyInvitedUsers =
          'User with such email is already invited to this project.';

        remove(existentUsersWithNumberId, (user) =>
          some(invites, (i) => {
            const isPresent = i.userId === user.id;
            if (isPresent) {
              failed.push(
                assign(
                  {},
                  {
                    email: i.email,
                    message: errMessageForAlreadyInvitedUsers,
                  },
                ),
              );
            }
            return isPresent;
          }),
        );

        existentUsersWithNumberId.forEach((user) => {
          const dataNew = cloneDeep(data);

          dataNew.userId = user.id;
          dataNew.email = user.email ? user.email.toLowerCase() : user.email;

          invitePromises.push(
            tx.projectMemberInvite.create({
              data: dataNew,
            }),
          );
        });

        // remove invites for users that are invited already
        remove(nonExistentUserEmails, (email) =>
          some(invites, (i) => {
            const areEmailsSame = this.compareEmail(i.email, email, {
              UNIQUE_GMAIL_VALIDATION: AppConfig.uniqueGmailValidation,
            });
            if (areEmailsSame) {
              failed.push(
                assign(
                  {},
                  {
                    email: i.email,
                    message: errMessageForAlreadyInvitedUsers,
                  },
                ),
              );
            }
            return areEmailsSame;
          }),
        );
        nonExistentUserEmails.forEach((email) => {
          const dataNew = cloneDeep(data);

          dataNew.email = email.toLowerCase();

          invitePromises.push(
            tx.projectMemberInvite.create({
              data: dataNew,
            }),
          );
        });
      } catch (error) {
        this.logger.error(error);
        forEach(inviteEmails, (email) =>
          failed.push(assign({}, { email, message: error.statusText })),
        );
      }
    }

    return invitePromises;
  }

  /**
   * Helper method to check the uniqueness of two emails
   *
   * @param {String} email1    first email to compare
   * @param {String} email2    second email to compare
   * @param {Object} options  the options
   *
   * @returns {Boolean} true if two emails are same
   */
  private compareEmail(
    email1,
    email2,
    options = { UNIQUE_GMAIL_VALIDATION: false },
  ) {
    if (options.UNIQUE_GMAIL_VALIDATION) {
      // email is gmail
      const emailSplit = /(^[\w.+-]+)(@gmail\.com|@googlemail\.com)$/g.exec(
        toLower(email1),
      );
      if (emailSplit) {
        const address = emailSplit[1].replace('.', '');
        const emailDomain = emailSplit[2].replace('.', '\\.');
        const regexAddress = address.split('').join('\\.?');
        const regex = new RegExp(`${regexAddress}${emailDomain}`);
        return regex.test(toLower(email2));
      }
    }
    return toLower(email1) === toLower(email2);
  }

  /**
   * Searches for project member invitations.
   * @param projectId - ID of the project to search invites for
   * @param query - Optional fields query for filtering and response shaping
   * @returns Promise resolving to an array of invite responses
   */
  async searchInvite(
    projectId: number,
    query: FieldsQueryDto,
    req: Request,
  ): Promise<InviteResponseDto[]> {
    await this.checkProjectExist(projectId);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const selectFields =
      Utils.parseCommaSeparatedString(
        query.fields,
        ALLOWED_PROJECT_MEMBER_INVITE_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_INVITE_FIELDS;

    const filterParam: any = {
      AND: [
        {
          projectId,
          status: {
            in: ['pending', 'requested'],
          },
          deletedBy: null,
        },
      ],
    };

    if (
      !Utils.hasPermissionByReq(PERMISSION.READ_PROJECT_INVITE_NOT_OWN, req)
    ) {
      filterParam.AND.push({
        OR: [
          {
            userId: authUser.userId,
          },
          {
            email: authUser.email,
          },
        ],
      });
    }

    let entities = await this.prisma.projectMemberInvite.findMany({
      where: filterParam,
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
   * Retrieves a specific project member invitation.
   * @param projectId - ID of the associated project
   * @param inviteId - ID of the invite to retrieve
   * @param query - Optional fields query for response shaping
   * @returns Promise resolving to the requested invite response
   */
  async getInvite(
    projectId: number,
    inviteId: number,
    query: FieldsQueryDto,
    req: Request,
  ): Promise<InviteResponseDto> {
    await this.checkProjectExist(projectId);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const selectFields =
      Utils.parseCommaSeparatedString(
        query.fields,
        ALLOWED_PROJECT_MEMBER_INVITE_FIELDS,
      ) || ALLOWED_PROJECT_MEMBER_INVITE_FIELDS;

    const filterParam: any = {
      AND: [
        {
          projectId,
          id: inviteId,
        },
      ],
    };

    if (
      !Utils.hasPermissionByReq(PERMISSION.READ_PROJECT_INVITE_NOT_OWN, req)
    ) {
      filterParam.AND.push({
        OR: [
          {
            userId: authUser.userId,
          },
          {
            email: authUser.email,
          },
        ],
      });
    }

    let entity = await this.prisma.projectMemberInvite.findFirst({
      where: filterParam,
    });

    if (!entity) {
      throw new NotFoundException(
        `invite not found for project id ${projectId}, inviteId ${inviteId}`,
      );
    }

    const entities = await this.utilService.getObjectsWithMemberDetails(
      [entity],
      selectFields,
      req,
    );

    entity = pick(entities[0], selectFields) as any;

    return entity as any;
  }

  /**
   * Updates an existing project member invitation.
   * @param authUser - Authenticated user updating the invitation
   * @param projectId - ID of the associated project
   * @param inviteId - ID of the invite to update
   * @param dto - Data transfer object containing updated invite details
   * @returns Promise resolving to the updated invite response
   */
  async updateInvite(
    projectId: number,
    inviteId: number,
    dto: UpdateInviteDto,
    req: Request,
  ): Promise<InviteResponseDto> {
    const newStatus = dto.status;
    const source = dto.source;
    if (newStatus === INVITE_STATUS.CANCELED) {
      throw new BadRequestException(
        'Cannot change invite status to “canceled”. Please, delete the invite instead.',
      );
    }

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const currentUserEmail = authUser.email
      ? authUser.email.toLowerCase()
      : authUser.email;
    const currentUserId = authUser.userId;

    const invite: any = await this.prisma.projectMemberInvite.findFirst({
      where: {
        projectId,
        id: inviteId,
        status: {
          in: ['pending', 'requested'],
        },
      },
    });

    if (!invite) {
      throw new NotFoundException(
        `invite not found for project id ${projectId}, inviteId ${inviteId}`,
      );
    }

    // check this invitation is for logged-in user or not
    const ownInvite =
      !!invite &&
      (invite.userId === currentUserId || invite.email === currentUserEmail);

    // check permission
    this.logger.debug('Checking user permission for updating invite');
    let error: string | null = null;

    if (
      invite.status === INVITE_STATUS.REQUESTED &&
      !Utils.hasPermissionByReq(PERMISSION.UPDATE_PROJECT_INVITE_REQUESTED, req)
    ) {
      error = "You don't have permissions to update requested invites.";
    } else if (
      invite.status !== INVITE_STATUS.REQUESTED &&
      !ownInvite &&
      !Utils.hasPermissionByReq(PERMISSION.UPDATE_PROJECT_INVITE_NOT_OWN, req)
    ) {
      error = "You don't have permissions to update invites for other users.";
    }

    if (error) {
      throw new ForbiddenException(error);
    }

    // Check if the copilot opportunity is still active
    // When the invited user tries to accept the invite
    if (invite.applicationId) {
      this.logger.debug(
        `Invite from copilot application: ${invite.applicationId}`,
      );
      const application = await this.prisma.copilotApplication.findFirst({
        where: {
          id: invite.applicationId,
        },
      });

      if (application) {
        const opportunity = await this.prisma.copilotOpportunity.findFirst({
          where: {
            id: application.opportunityId,
          },
        });

        if (opportunity) {
          this.logger.debug(
            `Copilot opportunity status: ${opportunity.status}`,
          );
          if (opportunity.status !== COPILOT_OPPORTUNITY_STATUS.ACTIVE) {
            this.logger.debug(`Copilot opportunity status is not active`);
            throw new ConflictException(
              'The copilot opportunity is not in active status',
            );
          }
        }
      }
    }

    return await this.prisma.$transaction(
      async (tx) => {
        this.logger.debug('Updating invite status');
        const updatedInvite = await tx.projectMemberInvite.update({
          where: {
            id: invite.id,
          },
          data: {
            status: newStatus as any,
          },
        });

        // emit the event
        const payload = assign(
          { resource: RESOURCES.PROJECT_MEMBER_INVITE },
          updatedInvite,
        );
        await this.eventBus.postBusEvent(
          EVENT.ROUTING_KEY.PROJECT_MEMBER_INVITE_UPDATED,
          payload,
        );

        this.logger.debug('Adding user to project');
        // add user to project if accept invite
        if (
          updatedInvite.status === INVITE_STATUS.ACCEPTED ||
          updatedInvite.status === INVITE_STATUS.REQUEST_APPROVED
        ) {
          let userId: any = updatedInvite.userId;
          // if the requesting user is updating his/her own invite
          if (!userId && currentUserEmail === updatedInvite.email) {
            userId = currentUserId;
          }
          // if we are not able to identify the user yet, it must be something wrong and we should not create
          // project member
          if (!userId) {
            throw new BadRequestException(
              `Unable to find userId for the invite. ${updatedInvite.email} has not joined topcoder yet.`,
            );
          }

          const userDetail = await this.utilService.getMemberDetailsByUserIds([
            userId,
          ]);

          const member = {
            projectId,
            role: updatedInvite.role,
            userId,
            handle: userDetail[0].handle,
            email: userDetail[0].email,
            firstName: userDetail[0].firstName,
            lastName: userDetail[0].lastName,
            createdBy: authUser.userId,
            updatedBy: authUser.userId,
          };

          await this.utilService.addUserToProject(tx, projectId, member);
          if (invite.applicationId) {
            let nextApplicationStatus = COPILOT_APPLICATION_STATUS.CANCELED;
            let nextOpportunityStatus = COPILOT_OPPORTUNITY_STATUS.CANCELED;
            let nextOpportunityRequestStatus = COPILOT_REQUEST_STATUS.CANCELED;
            if (source === INVITE_SOURCE.COPILOT_PORTAL) {
              nextApplicationStatus = COPILOT_APPLICATION_STATUS.ACCEPTED;
              nextOpportunityStatus = COPILOT_OPPORTUNITY_STATUS.COMPLETED;
              nextOpportunityRequestStatus = COPILOT_REQUEST_STATUS.FULFILLED;
            }

            const application = await tx.copilotApplication.update({
              where: {
                id: invite.applicationId,
              },
              data: {
                status: nextApplicationStatus as any,
              },
            });

            const opportunity = await tx.copilotOpportunity.update({
              where: {
                id: application.opportunityId,
              },
              data: {
                status: nextOpportunityStatus as any,
              },
            });

            await tx.copilotRequest.update({
              where: {
                id: opportunity.copilotRequestId,
              },
              data: {
                status: nextOpportunityRequestStatus as any,
              },
            });
          } else if (source === INVITE_SOURCE.WORK_MANAGER) {
            const allCopilotRequestsByProjectId =
              await tx.copilotRequest.findMany({
                where: {
                  projectId: invite.projectId,
                },
              });

            const requestIds = allCopilotRequestsByProjectId.map(
              (item) => item.id,
            );

            await tx.copilotRequest.updateMany({
              where: {
                id: {
                  in: requestIds,
                },
              },
              data: {
                status: COPILOT_REQUEST_STATUS.CANCELED as any,
              },
            });

            const allCopilotOpportunityByRequestIds =
              await tx.copilotOpportunity.findMany({
                where: {
                  copilotRequestId: {
                    in: requestIds,
                  },
                },
              });

            await tx.copilotOpportunity.updateMany({
              where: {
                id: {
                  in: allCopilotOpportunityByRequestIds.map((item) => item.id),
                },
              },
              data: {
                status: COPILOT_OPPORTUNITY_STATUS.CANCELED as any,
              },
            });

            const copilotApplications = await tx.copilotApplication.findMany({
              where: {
                opportunityId: {
                  in: allCopilotOpportunityByRequestIds.map((item) => item.id),
                },
              },
            });

            await tx.copilotApplication.updateMany({
              where: {
                id: {
                  in: copilotApplications.map((item) => item.id),
                },
              },
              data: {
                status: COPILOT_APPLICATION_STATUS.CANCELED as any,
              },
            });

            const invitesToBeUpdated = await tx.projectMemberInvite.findMany({
              where: {
                applicationId: {
                  in: copilotApplications.map((item) => item.id),
                },
              },
            });

            // Cancel the existing invites which are opened via
            // applications
            await tx.projectMemberInvite.updateMany({
              where: {
                id: {
                  in: copilotApplications.map((item) => item.id),
                },
              },
              data: {
                status: INVITE_STATUS.CANCELED as any,
              },
            });

            for (const inviteToBeUpdated of invitesToBeUpdated) {
              const payload = assign(
                { resource: RESOURCES.PROJECT_MEMBER_INVITE },
                inviteToBeUpdated,
              );
              await this.eventBus.postBusEvent(
                EVENT.ROUTING_KEY.PROJECT_MEMBER_INVITE_UPDATED,
                payload,
              );
            }
          }

          if (source === INVITE_SOURCE.COPILOT_PORTAL && invite.applicationId) {
            const application = await tx.copilotApplication.findFirst({
              where: {
                id: invite.applicationId,
              },
            });

            if (application) {
              const opportunity = await tx.copilotOpportunity.findFirst({
                where: {
                  id: application.opportunityId,
                },
                include: {
                  copilotRequest: true,
                },
              });

              if (opportunity) {
                const pmRole = await this.utilService.getRolesByRoleName(
                  USER_ROLE.PROJECT_MANAGER,
                );
                const { subjects = [] } = await this.utilService.getRoleInfo(
                  pmRole[0],
                );

                const creatorDetails =
                  await this.utilService.getMemberDetailsByUserIds([
                    Number(opportunity.createdBy),
                  ]);
                const inviteeDetails =
                  await this.utilService.getMemberDetailsByUserIds([
                    Number(application.userId),
                  ]);
                const creator = creatorDetails[0];
                const invitee = inviteeDetails[0];
                const listOfSubjects = subjects;
                if (creator && creator.email) {
                  const isCreatorPartofSubjects = subjects.find((item) => {
                    if (!item.email) {
                      return false;
                    }

                    return (
                      item.email.toLowerCase() === creator.email.toLowerCase()
                    );
                  });
                  if (!isCreatorPartofSubjects) {
                    listOfSubjects.push({
                      email: creator.email,
                      handle: creator.handle,
                    });
                  }
                }

                const emailEventType =
                  CONNECT_NOTIFICATION_EVENT.EXTERNAL_ACTION_EMAIL;
                const requestData: any = opportunity.copilotRequest.data;
                for (const subject of listOfSubjects) {
                  const payload = {
                    data: {
                      user_name: subject.handle,
                      opportunity_details_url: `${AppConfig.copilotPortalUrl}/opportunity/${opportunity.id}#applications`,
                      work_manager_url: AppConfig.workManagerUrl,
                      opportunity_type: Utils.getCopilotTypeLabel(
                        requestData?.projectType,
                      ),
                      opportunity_title: requestData.opportunityTitle,
                      copilot_handle: invitee ? invitee.handle : '',
                    },
                    sendgrid_template_id:
                      TEMPLATE_IDS.INFORM_PM_COPILOT_APPLICATION_ACCEPTED,
                    recipients: [subject.email],
                    version: 'v3',
                  };
                  await this.eventBus.postBusEvent(emailEventType, payload);
                }
              }
            }
          }
        } else if (updatedInvite.status === INVITE_STATUS.REFUSED) {
          // update the application if the invite
          // originated from copilot opportunity
          if (updatedInvite.applicationId) {
            const allPendingInvitesForApplication =
              await tx.projectMemberInvite.findMany({
                where: {
                  applicationId: invite.applicationId,
                  status: 'pending',
                },
              });

            // If only the current invite is the open one's
            // then the application status has to be moved to pending status
            if (allPendingInvitesForApplication.length === 0) {
              await tx.copilotApplication.update({
                where: {
                  id: updatedInvite.applicationId,
                },
                data: {
                  status: 'pending',
                },
              });
            }
          }
        }

        return Utils.postProcessInvites('$.email', updatedInvite, req);
      },
      {
        timeout: AppConfig.prismaTransactionTimeout,
      },
    );
  }

  /**
   * Deletes a project member invitation.
   * @param projectId - ID of the associated project
   * @param inviteId - ID of the invite to delete
   * @returns Promise that resolves when the invite is successfully deleted
   */
  async deleteInvite(
    projectId: number,
    inviteId: number,
    req: Request,
  ): Promise<void> {
    await this.checkProjectExist(projectId);

    const authUser = req['authUser'] as JwtUser; // Extract authenticated user from request

    const currentUserEmail = authUser.email
      ? authUser.email.toLowerCase()
      : authUser.email;
    const currentUserId = authUser.userId;

    const invite: any = await this.prisma.projectMemberInvite.findFirst({
      where: {
        projectId,
        id: inviteId,
        status: {
          in: ['pending', 'requested'],
        },
      },
    });

    if (!invite) {
      throw new NotFoundException(
        `invite not found for project id ${projectId}, inviteId ${inviteId}`,
      );
    }

    // check this invitation is for logged-in user or not
    const ownInvite =
      !!invite &&
      (invite.userId === currentUserId || invite.email === currentUserEmail);

    // check permission
    this.logger.debug('Checking user permission for deleting invite');
    let error: string | null = null;

    if (
      invite.status === INVITE_STATUS.REQUESTED &&
      !Utils.hasPermissionByReq(PERMISSION.DELETE_PROJECT_INVITE_REQUESTED, req)
    ) {
      error = "You don't have permissions to cancel requested invites.";
    } else if (
      invite.role !== PROJECT_MEMBER_ROLE.CUSTOMER &&
      invite.role !== PROJECT_MEMBER_ROLE.COPILOT &&
      !ownInvite &&
      !Utils.hasPermissionByReq(
        PERMISSION.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER,
        req,
      )
    ) {
      error =
        "You don't have permissions to cancel invites to Topcoder Team for other users.";
    } else if (
      invite.role === PROJECT_MEMBER_ROLE.CUSTOMER &&
      !ownInvite &&
      !Utils.hasPermissionByReq(
        PERMISSION.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER,
        req,
      )
    ) {
      error =
        "You don't have permissions to cancel invites to Customer Team for other users.";
    } else if (
      invite.role === PROJECT_MEMBER_ROLE.COPILOT &&
      !ownInvite &&
      !Utils.hasPermissionByReq(
        PERMISSION.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT,
        req,
      )
    ) {
      error =
        "You don't have permissions to cancel invites to Copilot Team for other users.";
    }

    if (error) {
      throw new ForbiddenException(error);
    }

    await this.prisma.$transaction(async (tx) => {
      this.logger.debug('Deleting (canceling) invite');
      const updatedInvite = await tx.projectMemberInvite.update({
        where: {
          id: invite.id,
        },
        data: {
          status: 'canceled',
        },
      });

      // emit the event
      const payload = assign(
        { resource: RESOURCES.PROJECT_MEMBER_INVITE },
        updatedInvite,
      );
      await this.eventBus.postBusEvent(
        EVENT.ROUTING_KEY.PROJECT_MEMBER_INVITE_REMOVED,
        payload,
      );

      // update the application if the invite
      // originated from copilot opportunity
      if (invite.applicationId) {
        const allPendingInvitesForApplication =
          await tx.projectMemberInvite.findMany({
            where: {
              applicationId: invite.applicationId,
              status: 'pending',
            },
          });
        // If only the current invite is the open one's
        // then the application status has to be moved to pending status
        if (allPendingInvitesForApplication.length === 0) {
          await tx.copilotApplication.update({
            where: {
              id: invite.applicationId,
            },
            data: {
              status: 'pending',
            },
          });
        }
      }
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
   * Get user handle by user id from user list. Used to generate error messages below.
   * You need to make sure user with specific userId exists in users.
   * @param {Number} userId user id
   * @param {Array} users user list
   * @returns {String} user handle
   */
  private getUserHandleById = (userId, users) => {
    const found = find(users, { userId });
    return found?.handle;
  };

  /**
   * Send invite email
   * @param {Object} authUser auth user
   * @param {Number} projectId project id
   * @param {Object} invite the member to invite
   */
  private async sendInviteEmail(authUser, projectId, invite) {
    this.logger.debug(
      `Sending invite email: ${projectId}, ${JSON.stringify(invite)}`,
    );
    this.logger.debug(authUser);
    const emailEventType = CONNECT_NOTIFICATION_EVENT.EXTERNAL_ACTION_EMAIL;
    const promises = [
      this.prisma.project.findFirst({
        where: { id: projectId },
      }),
      this.utilService.getMemberDetailsByUserIds([authUser.userId]),
    ];
    return Promise.all(promises)
      .then((responses) => {
        this.logger.debug(responses);
        const project = responses[0];
        const initiator =
          responses[1] && responses[1].length
            ? responses[1][0]
            : {
                userId: authUser.userId,
                firstName: 'Connect',
                lastName: 'User',
              };
        const payload = {
          data: {
            work_manager_url: AppConfig.workManagerUrl,
            accountsAppURL: AppConfig.accountsAppUrl,
            subject: AppConfig.inviteEmailSubject,
            projects: [
              {
                name: project.name,
                projectId,
                sections: [
                  {
                    EMAIL_INVITES: true,
                    title: AppConfig.inviteEmailSectionTitle,
                    projectName: project.name,
                    projectId,
                    initiator,
                    isSSO: Utils.isSSO(project),
                  },
                ],
              },
            ],
          },
          sendgrid_template_id: TEMPLATE_IDS.COPILOT_ALREADY_PART_OF_PROJECT,
          recipients: [invite.email],
          version: 'v3',
        };
        return this.eventBus.postBusEvent(emailEventType, payload);
      })
      .catch((error) => {
        this.logger.error(error);
      });
  }
}
