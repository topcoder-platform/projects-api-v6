import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CopilotApplicationStatus,
  CopilotOpportunityStatus,
  CopilotRequestStatus,
  InviteStatus,
  Prisma,
  ProjectMember,
  ProjectMemberRole,
  ProjectMemberInvite,
} from '@prisma/client';
import { CopilotNotificationService } from 'src/api/copilot/copilot-notification.service';
import { CreateInviteDto } from 'src/api/project-invite/dto/create-invite.dto';
import {
  GetInviteQueryDto,
  InviteListQueryDto,
} from 'src/api/project-invite/dto/invite-list-query.dto';
import {
  InviteBulkResponseDto,
  InviteFailureDto,
} from 'src/api/project-invite/dto/invite-response.dto';
import { UpdateInviteDto } from 'src/api/project-invite/dto/update-invite.dto';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import {
  EmailService,
  type InviteEmailInitiator,
} from 'src/shared/services/email.service';
import { IdentityService } from 'src/shared/services/identity.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  compareEmail,
  enrichInvitesWithUserDetails,
  validateUserHasProjectRole,
} from 'src/shared/utils/member.utils';
import { publishMemberEventSafely } from 'src/shared/utils/event.utils';
import { normalizeEntity as normalizePrismaEntity } from 'src/shared/utils/entity.utils';
import {
  ensureRoleScopedPermission,
  getActorUserId as getActorUserIdFromJwt,
  getAuditUserId as getAuditUserIdFromJwt,
  parseCsvFields,
  parseNumericStringId,
  parseOptionalNumericStringId,
} from 'src/shared/utils/service.utils';

interface InviteTargetByUser {
  userId: bigint;
  email?: string | null;
  handle?: string;
}

interface InviteTargetByEmail {
  email: string;
}

interface InviteMemberName {
  firstName?: string;
  lastName?: string;
}

/**
 * Manages project invite lifecycle across creation, updates, reads, and cancel.
 *
 * The service supports bulk invite creation from handles/emails, invite state
 * transitions, and copilot workflow side effects.
 *
 * Accepting or request-approving an invite auto-creates a `ProjectMember`
 * record when needed and updates linked copilot application state.
 *
 * Refusing or canceling an invite can move linked applications back to
 * `pending` when no open invites remain.
 *
 * `PROJECT_MEMBER_ADDED` events are published when invite acceptance yields a
 * project member.
 */
@Injectable()
export class ProjectInviteService {
  private readonly logger = LoggerService.forRoot('ProjectInviteService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly memberService: MemberService,
    private readonly identityService: IdentityService,
    private readonly emailService: EmailService,
    private readonly copilotNotificationService: CopilotNotificationService,
  ) {}

  /**
   * Creates invites for project users identified by handles or emails.
   *
   * @param projectId Project identifier.
   * @param dto Invite creation payload.
   * @param user Authenticated caller.
   * @param fields Optional CSV list of additional response fields.
   * @returns Bulk invite response with `success` and optional `failed` targets.
   * @throws {NotFoundException} If the project is not found.
   * @throws {ForbiddenException} If role-specific invite permission is missing.
   * @throws {BadRequestException} If handles/emails are both missing.
   */
  async createInvites(
    projectId: string,
    dto: CreateInviteDto,
    user: JwtUser,
    fields?: string,
  ): Promise<InviteBulkResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.prisma.project.findFirst({
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

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const canInviteCustomer = this.permissionService.hasNamedPermission(
      Permission.CREATE_PROJECT_INVITE_CUSTOMER,
      user,
      project.members,
    );
    const canInviteTopcoder = this.permissionService.hasNamedPermission(
      Permission.CREATE_PROJECT_INVITE_TOPCODER,
      user,
      project.members,
    );
    const canInviteCopilotDirectly = this.permissionService.hasNamedPermission(
      Permission.CREATE_PROJECT_INVITE_COPILOT,
      user,
      project.members,
    );

    if (dto.role === ProjectMemberRole.customer && !canInviteCustomer) {
      throw new ForbiddenException(
        `You are not allowed to invite user as ${dto.role}.`,
      );
    }

    if (
      dto.role !== ProjectMemberRole.customer &&
      !canInviteTopcoder &&
      !(dto.role === ProjectMemberRole.copilot && canInviteCopilotDirectly)
    ) {
      throw new ForbiddenException(
        `You are not allowed to invite user as ${dto.role}.`,
      );
    }

    if (
      (!dto.handles || dto.handles.length === 0) &&
      (!dto.emails || dto.emails.length === 0)
    ) {
      throw new BadRequestException('Either handles or emails are required');
    }

    const failed: InviteFailureDto[] = [];

    const existingInvites = await this.prisma.projectMemberInvite.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
        status: {
          in: [InviteStatus.pending, InviteStatus.requested],
        },
      },
    });

    const memberUserIds = new Set(
      project.members.map((member) => String(member.userId)),
    );

    const handleTargets = await this.resolveHandleTargets(
      dto,
      failed,
      memberUserIds,
      existingInvites,
    );

    const emailTargets = await this.resolveEmailTargets(
      dto,
      failed,
      memberUserIds,
      existingInvites,
    );

    const validatedUserTargets = await this.validateUserTargetsByRole(
      dto.role,
      handleTargets.concat(emailTargets.userTargets),
      failed,
    );

    const emailOnlyTargets = emailTargets.emailOnlyTargets;
    const userIdsResolvedFromEmails = new Set(
      emailTargets.userTargets.map((target) => String(target.userId)),
    );
    const knownInviteeNamesByUserId = await this.getMemberNameMapByUserIds(
      emailTargets.userTargets.map((target) => target.userId),
    );

    const status =
      dto.role !== ProjectMemberRole.copilot || canInviteCopilotDirectly
        ? InviteStatus.pending
        : InviteStatus.requested;

    const success = await this.prisma.$transaction(async (tx) => {
      const created: ProjectMemberInvite[] = [];

      for (const target of validatedUserTargets) {
        const invite = await tx.projectMemberInvite.create({
          data: {
            projectId: parsedProjectId,
            userId: target.userId,
            email: target.email ? target.email.toLowerCase() : null,
            role: dto.role,
            status,
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });

        created.push(invite);
      }

      for (const target of emailOnlyTargets) {
        const invite = await tx.projectMemberInvite.create({
          data: {
            projectId: parsedProjectId,
            email: target.email.toLowerCase(),
            role: dto.role,
            status,
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });

        created.push(invite);
      }

      return created;
    });

    let inviteInitiatorPromise: Promise<InviteEmailInitiator> | null = null;

    for (const invite of success) {
      const normalizedInvite = this.normalizeEntity(invite);
      const recipient = invite.email?.trim().toLowerCase();
      const isKnownEmailUserInvite =
        invite.userId !== null &&
        userIdsResolvedFromEmails.has(String(invite.userId));

      if (
        invite.email &&
        invite.status === InviteStatus.pending &&
        (!invite.userId || isKnownEmailUserInvite)
      ) {
        if (!inviteInitiatorPromise) {
          inviteInitiatorPromise = this.resolveInviteEmailInitiator(user);
        }

        const inviteeNames =
          invite.userId !== null
            ? knownInviteeNamesByUserId.get(String(invite.userId))
            : undefined;
        const invitePayload = {
          ...normalizedInvite,
          firstName: inviteeNames?.firstName,
          lastName: inviteeNames?.lastName,
        };

        this.logger.log(
          `Dispatching invite email publish for inviteId=${String(invite.id)} projectId=${projectId} recipient=${recipient} isSSO=${String(Boolean(isKnownEmailUserInvite))}`,
        );
        void this.emailService.sendInviteEmail(
          projectId,
          invitePayload,
          await inviteInitiatorPromise,
          project.name,
          {
            isSSO: Boolean(isKnownEmailUserInvite),
          },
        );
        continue;
      }

      if (invite.email) {
        this.logger.log(
          `Skipping invite email publish for inviteId=${String(invite.id)} projectId=${projectId} recipient=${recipient} reason=${this.getInviteEmailSkipReason(invite)}`,
        );
      }
    }

    const hydratedSuccess = await this.hydrateInviteListResponse(
      success,
      fields,
    );

    return {
      success: hydratedSuccess as InviteBulkResponseDto['success'],
      failed: failed.length > 0 ? failed : undefined,
    };
  }

  /**
   * Updates invite status and applies member/copilot side effects.
   *
   * @param projectId Project identifier.
   * @param inviteId Invite identifier.
   * @param dto Invite update payload.
   * @param user Authenticated caller.
   * @param fields Optional CSV list of additional response fields.
   * @returns The updated invite response payload.
   * @throws {NotFoundException} If the project or invite is not found.
   * @throws {ForbiddenException} If update permission is missing.
   * @throws {BadRequestException} If status/id/user resolution is invalid.
   * @throws {ConflictException} If linked opportunity is not active.
   */
  async updateInvite(
    projectId: string,
    inviteId: string,
    dto: UpdateInviteDto,
    user: JwtUser,
    fields?: string,
  ): Promise<unknown> {
    if (dto.status === InviteStatus.canceled) {
      throw new BadRequestException(
        'Cannot change invite status to "canceled". Delete the invite instead.',
      );
    }
    // TODO: SECURITY: No explicit state-machine transition guard exists here.
    // Add allowed transitions (for example:
    // pending -> accepted|refused and requested -> request_approved|refused).

    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedInviteId = this.parseId(inviteId, 'Invite');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.prisma.project.findFirst({
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

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const invite = await this.prisma.projectMemberInvite.findFirst({
      where: {
        id: parsedInviteId,
        projectId: parsedProjectId,
        deletedAt: null,
        status: {
          in: [InviteStatus.pending, InviteStatus.requested],
        },
      },
    });

    if (!invite) {
      throw new NotFoundException(
        `Invite not found for project id ${projectId}, inviteId ${inviteId}.`,
      );
    }

    const ownInvite = this.isOwnInvite(invite, user);

    if (
      invite.status === InviteStatus.requested &&
      !this.permissionService.hasNamedPermission(
        Permission.UPDATE_PROJECT_INVITE_REQUESTED,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to update requested invites.",
      );
    }

    if (
      invite.status !== InviteStatus.requested &&
      !ownInvite &&
      !this.permissionService.hasNamedPermission(
        Permission.UPDATE_PROJECT_INVITE_NOT_OWN,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to update invites for other users.",
      );
    }

    if (invite.applicationId) {
      await this.ensureActiveOpportunity(invite.applicationId);
    }

    // TODO: QUALITY: `work_manager` is a magic string. Extract a named
    // constant and reuse it where source comparisons occur.
    const source = dto.source || 'work_manager';

    const { updatedInvite, projectMember } = await this.prisma.$transaction(
      async (tx) => {
        let projectMemberEntity: ProjectMember | null = null;

        const updated = await tx.projectMemberInvite.update({
          where: {
            id: parsedInviteId,
          },
          data: {
            status: dto.status,
            updatedBy: auditUserId,
          },
        });

        if (
          updated.status === InviteStatus.accepted ||
          updated.status === InviteStatus.request_approved
        ) {
          const resolvedUserId = this.resolveInviteUserId(updated, user);

          if (!resolvedUserId) {
            throw new BadRequestException(
              `Unable to find userId for invite ${inviteId}.`,
            );
          }

          const member = await tx.projectMember.findFirst({
            where: {
              projectId: parsedProjectId,
              userId: resolvedUserId,
              deletedAt: null,
            },
          });

          if (!member) {
            projectMemberEntity = await tx.projectMember.create({
              data: {
                projectId: parsedProjectId,
                userId: resolvedUserId,
                role: updated.role,
                createdBy: auditUserId,
                updatedBy: auditUserId,
              },
            });
          } else {
            projectMemberEntity = member;
          }

          if (updated.applicationId) {
            await this.updateCopilotApplicationStateBySource(
              tx,
              updated.applicationId,
              source,
            );
          } else {
            // TODO: SECURITY: This currently cancels all project copilot
            // requests when `applicationId` is null. Scope cancellation to only
            // superseded requests.
            await this.cancelProjectCopilotWorkflow(tx, parsedProjectId);
          }
        } else if (
          updated.status === InviteStatus.refused &&
          updated.applicationId
        ) {
          await this.updateApplicationToPendingIfNoOpenInvites(
            tx,
            updated.applicationId,
          );
        }

        return {
          updatedInvite: updated,
          projectMember: projectMemberEntity,
        };
      },
    );

    if (projectMember) {
      this.publishMember(
        KAFKA_TOPIC.PROJECT_MEMBER_ADDED,
        this.normalizeEntity(projectMember),
      );
    }

    if (this.shouldNotifyCopilotInviteAccepted(updatedInvite, source)) {
      await this.notifyCopilotInviteAccepted(updatedInvite.applicationId);
    }

    return this.hydrateInviteResponse(updatedInvite, fields);
  }

  /**
   * Soft-cancels an invite by setting status to `canceled`.
   *
   * @param projectId Project identifier.
   * @param inviteId Invite identifier.
   * @param user Authenticated caller.
   * @returns Resolves when cancel operation and side effects complete.
   * @throws {NotFoundException} If the project or invite is not found.
   * @throws {ForbiddenException} If delete permission is missing.
   * @throws {BadRequestException} If ids are invalid.
   */
  async deleteInvite(
    projectId: string,
    inviteId: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedInviteId = this.parseId(inviteId, 'Invite');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.prisma.project.findFirst({
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

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const invite = await this.prisma.projectMemberInvite.findFirst({
      where: {
        id: parsedInviteId,
        projectId: parsedProjectId,
        deletedAt: null,
        status: {
          in: [InviteStatus.pending, InviteStatus.requested],
        },
      },
    });

    if (!invite) {
      throw new NotFoundException(
        `Invite not found for project id ${projectId}, inviteId ${inviteId}.`,
      );
    }

    const ownInvite = this.isOwnInvite(invite, user);

    if (
      invite.status === InviteStatus.requested &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_INVITE_REQUESTED,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to cancel requested invites.",
      );
    }

    if (!ownInvite) {
      this.ensureDeleteInvitePermission(invite.role, user, project.members);
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectMemberInvite.update({
        where: {
          id: parsedInviteId,
        },
        data: {
          status: InviteStatus.canceled,
          updatedBy: auditUserId,
        },
      });

      if (updated.applicationId) {
        await this.updateApplicationToPendingIfNoOpenInvites(
          tx,
          updated.applicationId,
        );
      }

      return updated;
    });
  }

  /**
   * Lists project invites visible to the current user.
   *
   * @param projectId Project identifier.
   * @param query Invite list query.
   * @param user Authenticated caller.
   * @returns Visible invite responses.
   * @throws {NotFoundException} If the project is not found.
   * @throws {ForbiddenException} If no read permission is granted.
   */
  async listInvites(
    projectId: string,
    query: InviteListQueryDto,
    user: JwtUser,
  ): Promise<unknown[]> {
    const parsedProjectId = this.parseId(projectId, 'Project');

    const project = await this.prisma.project.findFirst({
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

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const canReadAll = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_INVITE_NOT_OWN,
      user,
      project.members,
    );

    const canReadOwn = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_INVITE_OWN,
      user,
      project.members,
    );

    if (!canReadAll && !canReadOwn) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const invites = await this.prisma.projectMemberInvite.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
        status: {
          in: [InviteStatus.pending, InviteStatus.requested],
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    const visibleInvites = canReadAll
      ? invites
      : invites.filter((invite) => this.isOwnInvite(invite, user));

    return this.hydrateInviteListResponse(visibleInvites, query.fields);
  }

  /**
   * Gets a single invite if the current caller can read it.
   *
   * @param projectId Project identifier.
   * @param inviteId Invite identifier.
   * @param query Invite query.
   * @param user Authenticated caller.
   * @returns Invite response payload.
   * @throws {NotFoundException} If the project or invite is not found.
   * @throws {ForbiddenException} If read permission is missing.
   */
  async getInvite(
    projectId: string,
    inviteId: string,
    query: GetInviteQueryDto,
    user: JwtUser,
  ): Promise<unknown> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedInviteId = this.parseId(inviteId, 'Invite');

    const project = await this.prisma.project.findFirst({
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

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const canReadAll = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_INVITE_NOT_OWN,
      user,
      project.members,
    );

    const canReadOwn = this.permissionService.hasNamedPermission(
      Permission.READ_PROJECT_INVITE_OWN,
      user,
      project.members,
    );

    if (!canReadAll && !canReadOwn) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const invite = await this.prisma.projectMemberInvite.findFirst({
      where: {
        id: parsedInviteId,
        projectId: parsedProjectId,
        deletedAt: null,
        status: {
          in: [InviteStatus.pending, InviteStatus.requested],
        },
      },
    });

    if (!invite) {
      throw new NotFoundException(
        `Invite not found for project id ${projectId}, inviteId ${inviteId}.`,
      );
    }

    if (!canReadAll && !this.isOwnInvite(invite, user)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.hydrateInviteResponse(invite, query.fields);
  }

  /**
   * Resolves invite targets from provided handles.
   *
   * @param dto Invite creation payload.
   * @param failed Mutable array collecting failed target reasons.
   * @param memberUserIds Existing member user ids.
   * @param existingInvites Existing open invites.
   * @returns User-backed invite targets.
   * @throws {BadRequestException} When handle payload normalization fails.
   */
  private async resolveHandleTargets(
    dto: CreateInviteDto,
    failed: InviteFailureDto[],
    memberUserIds: Set<string>,
    existingInvites: ProjectMemberInvite[],
  ): Promise<InviteTargetByUser[]> {
    if (!dto.handles || dto.handles.length === 0) {
      return [];
    }

    const foundUsers = await this.memberService.getMemberDetailsByHandles(
      dto.handles,
    );
    const lowerCaseHandles = dto.handles.map((handle) => handle.toLowerCase());

    const filteredUsers = foundUsers.filter((foundUser) =>
      lowerCaseHandles.includes(
        String(foundUser.handleLower || foundUser.handle || '').toLowerCase(),
      ),
    );

    const existingHandles = new Set(
      filteredUsers.map((user) =>
        String(user.handleLower || user.handle || '').toLowerCase(),
      ),
    );

    const notFoundHandles = lowerCaseHandles.filter(
      (handle) => !existingHandles.has(handle),
    );

    for (const handle of notFoundHandles) {
      failed.push({
        handle,
        message:
          "We couldn't find a user with the provided username. Please verify casing and spelling.",
      });
    }

    const targets: InviteTargetByUser[] = [];

    for (const user of filteredUsers) {
      const userId = this.parseOptionalId(user.userId);
      if (!userId) {
        continue;
      }

      if (memberUserIds.has(String(userId))) {
        failed.push({
          handle: user.handle || undefined,
          message: 'User with such handle is already a member of the team.',
          error: 'ALREADY_MEMBER',
        });
        continue;
      }

      const duplicateInvite = existingInvites.find(
        (invite) => invite.userId && invite.userId === userId,
      );

      if (duplicateInvite) {
        failed.push({
          handle: user.handle || undefined,
          message: 'User with such handle is already invited to this project.',
        });
        continue;
      }

      targets.push({
        userId,
        email: user.email || null,
        handle: user.handle || undefined,
      });
    }

    return targets;
  }

  /**
   * Resolves invite targets from provided emails.
   *
   * @param dto Invite creation payload.
   * @param failed Mutable array collecting failed target reasons.
   * @param memberUserIds Existing member user ids.
   * @param existingInvites Existing open invites.
   * @returns User-backed targets and email-only targets.
   * @throws {BadRequestException} If email validation or parsing fails.
   */
  private async resolveEmailTargets(
    dto: CreateInviteDto,
    failed: InviteFailureDto[],
    memberUserIds: Set<string>,
    existingInvites: ProjectMemberInvite[],
  ): Promise<{
    userTargets: InviteTargetByUser[];
    emailOnlyTargets: InviteTargetByEmail[];
  }> {
    if (!dto.emails || dto.emails.length === 0) {
      return {
        userTargets: [],
        emailOnlyTargets: [],
      };
    }

    if (dto.role !== ProjectMemberRole.customer) {
      for (const email of dto.emails) {
        failed.push({
          email,
          message: `Emails can only be used for ${ProjectMemberRole.customer}`,
        });
      }

      return {
        userTargets: [],
        emailOnlyTargets: [],
      };
    }

    const normalizedEmails = dto.emails.map((email) => email.toLowerCase());
    const usersByEmail =
      await this.identityService.lookupMultipleUserEmails(normalizedEmails);

    const userTargets: InviteTargetByUser[] = [];
    const emailOnlyTargets: InviteTargetByEmail[] = [];

    for (const email of normalizedEmails) {
      const existingUser = usersByEmail.find((candidate) =>
        compareEmail(candidate.email, email),
      );

      if (!existingUser) {
        const duplicate = existingInvites.find((invite) =>
          compareEmail(invite.email, email, {
            UNIQUE_GMAIL_VALIDATION: this.isUniqueGmailValidationEnabled(),
          }),
        );

        if (duplicate) {
          failed.push({
            email,
            message: 'User with such email is already invited to this project.',
          });
          continue;
        }

        emailOnlyTargets.push({ email });
        continue;
      }

      const parsedUserId = this.parseOptionalId(existingUser.id);
      if (!parsedUserId) {
        continue;
      }

      if (memberUserIds.has(String(parsedUserId))) {
        failed.push({
          email,
          message: 'User with such email is already a member of the team.',
          error: 'ALREADY_MEMBER',
        });
        continue;
      }

      const duplicateByUser = existingInvites.find(
        (invite) => invite.userId && invite.userId === parsedUserId,
      );

      if (duplicateByUser) {
        failed.push({
          email,
          message: 'User with such email is already invited to this project.',
        });
        continue;
      }

      userTargets.push({
        userId: parsedUserId,
        email,
        handle: existingUser.handle,
      });
    }

    return {
      userTargets,
      emailOnlyTargets,
    };
  }

  /**
   * Validates that user targets can be invited for the requested project role.
   *
   * @param role Target invite role.
   * @param targets Candidate user targets.
   * @param failed Mutable array collecting failed target reasons.
   * @returns Only targets that satisfy role constraints.
   * @throws {ForbiddenException} Role validation may fail at downstream calls.
   */
  // TODO: QUALITY: This calls `memberService.getUserRoles` sequentially in a
  // loop. Batch requests or use `Promise.all` to reduce latency.
  private async validateUserTargetsByRole(
    role: ProjectMemberRole,
    targets: InviteTargetByUser[],
    failed: InviteFailureDto[],
  ): Promise<InviteTargetByUser[]> {
    if (targets.length === 0 || role === ProjectMemberRole.customer) {
      return targets;
    }

    const validTargets: InviteTargetByUser[] = [];

    for (const target of targets) {
      const roles = await this.memberService.getUserRoles(target.userId);
      const isAllowed = validateUserHasProjectRole(role, roles);

      if (!isAllowed) {
        failed.push({
          handle: target.handle,
          email: target.email || undefined,
          message: `cannot be invited with a "${role}" role to the project`,
        });
        continue;
      }

      validTargets.push(target);
    }

    return validTargets;
  }

  /**
   * Ensures the application points to an active copilot opportunity.
   *
   * @param applicationId Copilot application identifier.
   * @returns Resolves when the opportunity is active.
   * @throws {ConflictException} If application/opportunity is missing/inactive.
   */
  private async ensureActiveOpportunity(applicationId: bigint): Promise<void> {
    const application = await this.prisma.copilotApplication.findFirst({
      where: {
        id: applicationId,
      },
    });

    if (!application) {
      throw new ConflictException(
        `Application ${String(applicationId)} was not found for this invite.`,
      );
    }

    const opportunity = await this.prisma.copilotOpportunity.findFirst({
      where: {
        id: application.opportunityId,
      },
    });

    if (
      !opportunity ||
      opportunity.status !== CopilotOpportunityStatus.active
    ) {
      throw new ConflictException(
        'The copilot opportunity is not in active status',
      );
    }
  }

  /**
   * Updates copilot application/opportunity/request states by invite source.
   *
   * @param tx Active transaction client.
   * @param applicationId Application identifier.
   * @param source Invite update source value.
   * @returns Resolves after related entities are updated.
   * @throws {Prisma.PrismaClientKnownRequestError} If transaction updates fail.
   */
  private async updateCopilotApplicationStateBySource(
    tx: Prisma.TransactionClient,
    applicationId: bigint,
    source: string,
  ): Promise<void> {
    const application = await tx.copilotApplication.findFirst({
      where: {
        id: applicationId,
      },
    });

    if (!application) {
      return;
    }

    const opportunity = await tx.copilotOpportunity.findFirst({
      where: {
        id: application.opportunityId,
      },
    });

    if (!opportunity) {
      return;
    }

    const request = opportunity.copilotRequestId
      ? await tx.copilotRequest.findFirst({
          where: {
            id: opportunity.copilotRequestId,
          },
        })
      : null;

    const isCopilotPortal = source === 'copilot_portal';

    await tx.copilotApplication.update({
      where: {
        id: application.id,
      },
      data: {
        status: isCopilotPortal
          ? CopilotApplicationStatus.accepted
          : CopilotApplicationStatus.canceled,
      },
    });

    await tx.copilotOpportunity.update({
      where: {
        id: opportunity.id,
      },
      data: {
        status: isCopilotPortal
          ? CopilotOpportunityStatus.completed
          : CopilotOpportunityStatus.canceled,
      },
    });

    if (request) {
      await tx.copilotRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: isCopilotPortal
            ? CopilotRequestStatus.fulfilled
            : CopilotRequestStatus.canceled,
        },
      });
    }
  }

  private shouldNotifyCopilotInviteAccepted(
    invite: ProjectMemberInvite,
    source: string,
  ): invite is ProjectMemberInvite & { applicationId: bigint } {
    return (
      source === 'copilot_portal' &&
      Boolean(invite.applicationId) &&
      (invite.status === InviteStatus.accepted ||
        invite.status === InviteStatus.request_approved)
    );
  }

  private async notifyCopilotInviteAccepted(
    applicationId: bigint,
  ): Promise<void> {
    const application = await this.prisma.copilotApplication.findFirst({
      where: {
        id: applicationId,
        deletedAt: null,
      },
    });

    if (!application) {
      this.logger.warn(
        `Skipping copilot invite accepted notification: application=${applicationId.toString()} not found.`,
      );
      return;
    }

    const opportunity = await this.prisma.copilotOpportunity.findFirst({
      where: {
        id: application.opportunityId,
        deletedAt: null,
      },
      include: {
        copilotRequest: true,
      },
    });

    if (!opportunity) {
      this.logger.warn(
        `Skipping copilot invite accepted notification: opportunity=${application.opportunityId.toString()} not found.`,
      );
      return;
    }

    await this.copilotNotificationService.sendCopilotInviteAcceptedNotification(
      opportunity,
      application,
    );
  }

  /**
   * Cancels project-level copilot workflow records.
   *
   * @param tx Active transaction client.
   * @param projectId Project identifier.
   * @returns Resolves when request/opportunity/application/invite status
   * updates complete.
   * @throws {Prisma.PrismaClientKnownRequestError} If transaction updates fail.
   */
  // TODO: SECURITY: This can cancel all copilot requests in the project when
  // invoked from invite acceptance without `applicationId`. Narrow the scope to
  // superseded workflow records only.
  private async cancelProjectCopilotWorkflow(
    tx: Prisma.TransactionClient,
    projectId: bigint,
  ): Promise<void> {
    const requests = await tx.copilotRequest.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const requestIds = requests.map((request) => request.id);

    if (requestIds.length === 0) {
      return;
    }

    await tx.copilotRequest.updateMany({
      where: {
        id: {
          in: requestIds,
        },
      },
      data: {
        status: CopilotRequestStatus.canceled,
      },
    });

    const opportunities = await tx.copilotOpportunity.findMany({
      where: {
        copilotRequestId: {
          in: requestIds,
        },
      },
      select: {
        id: true,
      },
    });

    const opportunityIds = opportunities.map((opportunity) => opportunity.id);

    if (opportunityIds.length === 0) {
      return;
    }

    await tx.copilotOpportunity.updateMany({
      where: {
        id: {
          in: opportunityIds,
        },
      },
      data: {
        status: CopilotOpportunityStatus.canceled,
      },
    });

    const applications = await tx.copilotApplication.findMany({
      where: {
        opportunityId: {
          in: opportunityIds,
        },
      },
      select: {
        id: true,
      },
    });

    const applicationIds = applications.map((application) => application.id);

    if (applicationIds.length > 0) {
      await tx.copilotApplication.updateMany({
        where: {
          id: {
            in: applicationIds,
          },
        },
        data: {
          status: CopilotApplicationStatus.canceled,
        },
      });

      await tx.projectMemberInvite.updateMany({
        where: {
          applicationId: {
            in: applicationIds,
          },
          status: {
            in: [InviteStatus.pending, InviteStatus.requested],
          },
        },
        data: {
          status: InviteStatus.canceled,
        },
      });
    }
  }

  /**
   * Resets an application to pending when no open invites reference it.
   *
   * @param tx Active transaction client.
   * @param applicationId Application identifier.
   * @returns Resolves when the application status is reconciled.
   * @throws {Prisma.PrismaClientKnownRequestError} If transaction updates fail.
   */
  private async updateApplicationToPendingIfNoOpenInvites(
    tx: Prisma.TransactionClient,
    applicationId: bigint,
  ): Promise<void> {
    const openInvites = await tx.projectMemberInvite.count({
      where: {
        applicationId,
        status: {
          in: [InviteStatus.pending, InviteStatus.requested],
        },
        deletedAt: null,
      },
    });

    if (openInvites === 0) {
      await tx.copilotApplication.updateMany({
        where: {
          id: applicationId,
        },
        data: {
          status: CopilotApplicationStatus.pending,
        },
      });
    }
  }

  /**
   * Enforces role-specific permissions when deleting another user's invite.
   *
   * @param role Invite target role.
   * @param user Authenticated caller.
   * @param projectMembers Active project members for permission evaluation.
   * @returns Nothing.
   * @throws {ForbiddenException} If required delete permission is missing.
   */
  private ensureDeleteInvitePermission(
    role: ProjectMemberRole,
    user: JwtUser,
    projectMembers: ProjectMember[],
  ): void {
    ensureRoleScopedPermission(
      this.permissionService,
      role,
      user,
      projectMembers,
      {
        permission: Permission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER,
        message:
          "You don't have permissions to cancel invites to Topcoder Team for other users.",
      },
      {
        [ProjectMemberRole.customer]: {
          permission: Permission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER,
          message:
            "You don't have permissions to cancel invites to Customer Team for other users.",
        },
        [ProjectMemberRole.copilot]: {
          permission: Permission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT,
          message:
            "You don't have permissions to cancel invites to Copilot Team for other users.",
        },
      },
    );
  }

  /**
   * Resolves user id for invite acceptance from invite or current user context.
   *
   * @param invite Invite entity.
   * @param user Authenticated caller.
   * @returns Resolved user id or `null`.
   * @throws {BadRequestException} When caller id cannot be parsed.
   */
  private resolveInviteUserId(
    invite: ProjectMemberInvite,
    user: JwtUser,
  ): bigint | null {
    if (invite.userId) {
      return invite.userId;
    }

    const userEmail = this.getUserEmail(user);
    if (invite.email && userEmail && compareEmail(invite.email, userEmail)) {
      return this.parseOptionalId(user.userId) || null;
    }

    return null;
  }

  /**
   * Returns a stable reason when invite-email publishing is not attempted.
   *
   * @param invite Invite entity.
   * @returns Machine-friendly skip reason.
   */
  private getInviteEmailSkipReason(invite: ProjectMemberInvite): string {
    if (!invite.email) {
      return 'missing-email';
    }

    if (invite.userId) {
      return 'invite-linked-to-user';
    }

    if (invite.status !== InviteStatus.pending) {
      return `status-${String(invite.status)}`;
    }

    return 'not-eligible';
  }

  /**
   * Determines whether the invite belongs to the current user.
   *
   * @param invite Invite entity.
   * @param user Authenticated caller.
   * @returns `true` when owned by user id or matched email.
   * @throws {BadRequestException} When caller identity cannot be parsed.
   */
  private isOwnInvite(invite: ProjectMemberInvite, user: JwtUser): boolean {
    const currentUserId = this.parseOptionalId(user.userId);
    const currentUserEmail = this.getUserEmail(user);

    if (invite.userId && currentUserId && invite.userId === currentUserId) {
      return true;
    }

    if (invite.email && currentUserEmail) {
      return compareEmail(invite.email, currentUserEmail, {
        UNIQUE_GMAIL_VALIDATION: this.isUniqueGmailValidationEnabled(),
      });
    }

    return false;
  }

  /**
   * Hydrates invite list responses with requested user profile fields.
   *
   * @param invites Invite entities.
   * @param fields Optional CSV response fields.
   * @returns Hydrated invite response list.
   * @throws {BadRequestException} When field parsing fails.
   */
  private async hydrateInviteListResponse(
    invites: ProjectMemberInvite[],
    fields?: string,
  ): Promise<unknown[]> {
    if (!Array.isArray(invites) || invites.length === 0) {
      return [];
    }

    const requestedFields = this.parseFields(fields);
    const userIds = invites
      .map((invite) => invite.userId)
      .filter((value): value is bigint => value !== null);

    const details =
      requestedFields.length > 0
        ? await this.memberService.getMemberDetailsByUserIds(userIds)
        : [];

    return enrichInvitesWithUserDetails(
      this.normalizeEntity(invites),
      requestedFields,
      details,
    );
  }

  /**
   * Hydrates a single invite response payload.
   *
   * @param invite Invite entity.
   * @param fields Optional CSV response fields.
   * @returns Hydrated invite response.
   * @throws {BadRequestException} When field parsing fails.
   */
  private async hydrateInviteResponse(
    invite: ProjectMemberInvite,
    fields?: string,
  ): Promise<unknown> {
    const [response] = await this.hydrateInviteListResponse([invite], fields);
    return response;
  }

  /**
   * Parses and validates required numeric id values.
   *
   * @param value Raw id value.
   * @param label Friendly name used in error message text.
   * @returns Parsed bigint id.
   * @throws {BadRequestException} If value is not numeric.
   */
  private parseId(value: string, label: string): bigint {
    return parseNumericStringId(value, `${label} id`);
  }

  /**
   * Parses optional id values into bigint.
   *
   * @param value Raw id-like value.
   * @returns Parsed bigint or `null` when missing/invalid.
   * @throws {BadRequestException} If parsing fails unexpectedly.
   */
  private parseOptionalId(
    value: string | number | bigint | null | undefined,
  ): bigint | null {
    return parseOptionalNumericStringId(value);
  }

  /**
   * Resolves authenticated caller id as a normalized string.
   *
   * @param user Authenticated caller.
   * @returns Trimmed caller id.
   * @throws {ForbiddenException} If caller id is missing.
   */
  private getActorUserId(user: JwtUser): string {
    return getActorUserIdFromJwt(user);
  }

  /**
   * Resolves authenticated caller id as numeric audit id.
   *
   * @param user Authenticated caller.
   * @returns Numeric audit user id.
   * @throws {ForbiddenException} If caller id is missing or non-numeric.
   */
  private getAuditUserId(user: JwtUser): number {
    return getAuditUserIdFromJwt(user);
  }

  /**
   * Parses CSV field selection for invite response hydration.
   *
   * @param fields Raw CSV field list.
   * @returns Normalized field names.
   * @throws {BadRequestException} If field parsing fails.
   */
  private parseFields(fields?: string): string[] {
    return parseCsvFields(fields);
  }

  /**
   * Extracts user email claim from token payload.
   *
   * @param user Authenticated caller.
   * @returns Lower-cased email if present.
   * @throws {BadRequestException} If payload claims are malformed.
   */
  // TODO: SECURITY: Iterating all payload keys ending with `email` is fragile
  // and may match unintended claims. Use explicit claim key(s).
  private getUserEmail(user: JwtUser): string | undefined {
    const payload = user.tokenPayload || {};

    for (const key of Object.keys(payload)) {
      if (key.toLowerCase().endsWith('email')) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim().toLowerCase();
        }
      }
    }

    return undefined;
  }

  /**
   * Resolves invite initiator details for email templates.
   *
   * Uses token context first and enriches with Member API profile fields when
   * the caller user id is available.
   *
   * @param user Authenticated caller.
   * @returns Normalized initiator payload for invite emails.
   */
  private async resolveInviteEmailInitiator(
    user: JwtUser,
  ): Promise<InviteEmailInitiator> {
    const initiator: InviteEmailInitiator = {
      userId: user.userId,
      handle: user.handle,
      email: this.getUserEmail(user),
    };

    const initiatorUserId = this.parseOptionalId(user.userId);
    if (!initiatorUserId) {
      return initiator;
    }

    const memberDetails = await this.memberService.getMemberDetailsByUserIds([
      initiatorUserId,
    ]);
    const matchedInitiator = memberDetails.find(
      (detail) =>
        String(detail.userId || '').trim() === String(initiatorUserId),
    );

    if (!matchedInitiator) {
      return initiator;
    }

    if (matchedInitiator.firstName) {
      initiator.firstName = String(matchedInitiator.firstName).trim();
    }
    if (matchedInitiator.lastName) {
      initiator.lastName = String(matchedInitiator.lastName).trim();
    }
    if (matchedInitiator.email) {
      initiator.email = String(matchedInitiator.email).trim().toLowerCase();
    }
    if (matchedInitiator.handle) {
      initiator.handle = String(matchedInitiator.handle).trim();
    }

    return initiator;
  }

  /**
   * Builds a lookup map of member first/last names keyed by user id.
   *
   * @param userIds User ids to resolve in Member API.
   * @returns Map of user id to first/last name values.
   */
  private async getMemberNameMapByUserIds(
    userIds: Array<string | number | bigint>,
  ): Promise<Map<string, InviteMemberName>> {
    const normalizedUserIds = Array.from(
      new Set(
        userIds
          .map((userId) => String(userId || '').trim())
          .filter((userId) => userId.length > 0),
      ),
    );

    if (normalizedUserIds.length === 0) {
      return new Map();
    }

    const details =
      await this.memberService.getMemberDetailsByUserIds(normalizedUserIds);
    const detailsMap = new Map<string, InviteMemberName>();

    for (const detail of details) {
      const userId = String(detail.userId || '').trim();
      if (!userId) {
        continue;
      }

      detailsMap.set(userId, {
        firstName: detail.firstName
          ? String(detail.firstName).trim()
          : undefined,
        lastName: detail.lastName ? String(detail.lastName).trim() : undefined,
      });
    }

    return detailsMap;
  }

  /**
   * Resolves UNIQUE_GMAIL_VALIDATION runtime toggle.
   *
   * @returns `true` when unique Gmail validation is enabled.
   * @throws {Error} Never intentionally thrown.
   */
  // TODO: SECURITY: Reading `process.env` at call-time should be replaced with
  // injected `ConfigService` configuration for testability and consistency.
  private isUniqueGmailValidationEnabled(): boolean {
    return (
      String(process.env.UNIQUE_GMAIL_VALIDATION || 'false').toLowerCase() ===
      'true'
    );
  }

  /**
   * Normalizes Prisma entities for API/event payload serialization.
   *
   * @param payload Input payload.
   * @returns Payload with bigint and decimal values normalized.
   * @throws {TypeError} If recursive traversal fails.
   */
  private normalizeEntity<T>(payload: T): T {
    return normalizePrismaEntity(payload);
  }

  /**
   * Publishes member event payloads and logs failures.
   *
   * @param topic Kafka topic.
   * @param payload Event payload.
   * @returns Nothing.
   * @throws {Error} Publisher errors are caught and logged.
   */
  private publishMember(topic: string, payload: unknown): void {
    publishMemberEventSafely(topic, payload, this.logger);
  }
}
