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
import { EmailService } from 'src/shared/services/email.service';
import { IdentityService } from 'src/shared/services/identity.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  compareEmail,
  enrichInvitesWithUserDetails,
  validateUserHasProjectRole,
} from 'src/shared/utils/member.utils';
import { publishMemberEvent } from 'src/shared/utils/event.utils';

interface InviteTargetByUser {
  userId: bigint;
  email?: string | null;
  handle?: string;
}

interface InviteTargetByEmail {
  email: string;
}

@Injectable()
export class ProjectInviteService {
  private readonly logger = LoggerService.forRoot('ProjectInviteService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly memberService: MemberService,
    private readonly identityService: IdentityService,
    private readonly emailService: EmailService,
  ) {}

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

    for (const invite of success) {
      const normalizedInvite = this.normalizeEntity(invite);
      if (
        invite.email &&
        !invite.userId &&
        invite.status === InviteStatus.pending
      ) {
        void this.emailService.sendInviteEmail(
          projectId,
          normalizedInvite,
          {
            userId: user.userId,
            handle: user.handle,
          },
          project.name,
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

    return this.hydrateInviteResponse(updatedInvite, fields);
  }

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
        String(
          (foundUser as any).handleLower || foundUser.handle || '',
        ).toLowerCase(),
      ),
    );

    const existingHandles = new Set(
      filteredUsers.map((user) =>
        String((user as any).handleLower || user.handle || '').toLowerCase(),
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
      const userId = this.parseOptionalId((user as any).userId);
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

  private ensureDeleteInvitePermission(
    role: ProjectMemberRole,
    user: JwtUser,
    projectMembers: any[],
  ): void {
    if (
      role !== ProjectMemberRole.customer &&
      role !== ProjectMemberRole.copilot &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER,
        user,
        projectMembers,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to cancel invites to Topcoder Team for other users.",
      );
    }

    if (
      role === ProjectMemberRole.customer &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER,
        user,
        projectMembers,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to cancel invites to Customer Team for other users.",
      );
    }

    if (
      role === ProjectMemberRole.copilot &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT,
        user,
        projectMembers,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to cancel invites to Copilot Team for other users.",
      );
    }
  }

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

  private async hydrateInviteResponse(
    invite: ProjectMemberInvite,
    fields?: string,
  ): Promise<unknown> {
    const [response] = await this.hydrateInviteListResponse([invite], fields);
    return response;
  }

  private parseId(value: string, label: string): bigint {
    const normalized = String(value || '').trim();
    if (!/^\d+$/.test(normalized)) {
      throw new BadRequestException(`${label} id must be a numeric string.`);
    }

    return BigInt(normalized);
  }

  private parseOptionalId(
    value: string | number | bigint | null | undefined,
  ): bigint | null {
    if (value === null || typeof value === 'undefined') {
      return null;
    }

    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) {
      return null;
    }

    return BigInt(normalized);
  }

  private getActorUserId(user: JwtUser): string {
    if (!user?.userId || String(user.userId).trim().length === 0) {
      throw new ForbiddenException('Authenticated user id is missing.');
    }

    return String(user.userId).trim();
  }

  private getAuditUserId(user: JwtUser): number {
    const parsedUserId = Number.parseInt(this.getActorUserId(user), 10);

    if (Number.isNaN(parsedUserId)) {
      throw new ForbiddenException('Authenticated user id must be numeric.');
    }

    return parsedUserId;
  }

  private parseFields(fields?: string): string[] {
    if (!fields || fields.trim().length === 0) {
      return [];
    }

    return fields
      .split(',')
      .map((field) => field.trim())
      .filter((field) => field.length > 0);
  }

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

  private isUniqueGmailValidationEnabled(): boolean {
    return (
      String(process.env.UNIQUE_GMAIL_VALIDATION || 'false').toLowerCase() ===
      'true'
    );
  }

  private normalizeEntity<T>(payload: T): T {
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

  private publishMember(topic: string, payload: unknown): void {
    void publishMemberEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish member event topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}
