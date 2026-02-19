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
} from '@prisma/client';
import { CreateMemberDto } from 'src/api/project-member/dto/create-member.dto';
import {
  MemberListQueryDto,
  GetMemberQueryDto,
} from 'src/api/project-member/dto/member-list-query.dto';
import { UpdateMemberDto } from 'src/api/project-member/dto/update-member.dto';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { LoggerService } from 'src/shared/modules/global/logger.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { MemberService } from 'src/shared/services/member.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  enrichMembersWithUserDetails,
  getDefaultProjectRole,
  validateUserHasProjectRole,
} from 'src/shared/utils/member.utils';
import { publishMemberEvent } from 'src/shared/utils/event.utils';

@Injectable()
export class ProjectMemberService {
  private readonly logger = LoggerService.forRoot('ProjectMemberService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly memberService: MemberService,
  ) {}

  async addMember(
    projectId: string,
    dto: CreateMemberDto,
    user: JwtUser,
    fields?: string,
  ): Promise<unknown> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const auditUserId = this.getAuditUserId(user);
    const actorUserId = this.getActorUserId(user);

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

    const targetUserId =
      typeof dto.userId === 'number' && Number.isFinite(dto.userId)
        ? String(Math.trunc(dto.userId))
        : actorUserId;

    const isOwnMember = targetUserId === actorUserId;

    if (
      isOwnMember &&
      !this.permissionService.hasNamedPermission(
        Permission.CREATE_PROJECT_MEMBER_OWN,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (
      !isOwnMember &&
      !this.permissionService.hasNamedPermission(
        Permission.CREATE_PROJECT_MEMBER_NOT_OWN,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to add other users as a project member.",
      );
    }

    const targetRole = dto.role || getDefaultProjectRole(user);

    if (!targetRole) {
      throw new BadRequestException(
        'Cannot automatically detect role for a new member.',
      );
    }

    const topcoderRoles =
      isOwnMember && Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles
        : await this.memberService.getUserRoles(targetUserId);

    if (!validateUserHasProjectRole(targetRole, topcoderRoles)) {
      throw new ForbiddenException(
        `User doesn't have required Topcoder roles to be added with role "${targetRole}".`,
      );
    }

    const existingMember = project.members.find(
      (member) => String(member.userId) === targetUserId,
    );

    if (existingMember) {
      throw new ConflictException(
        `User already registered for role: ${existingMember.role}`,
      );
    }

    const createdMember = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectMember.create({
        data: {
          projectId: parsedProjectId,
          userId: BigInt(targetUserId),
          role: targetRole,
          createdBy: auditUserId,
          updatedBy: auditUserId,
        },
      });

      await tx.projectMemberInvite.updateMany({
        where: {
          projectId: parsedProjectId,
          userId: BigInt(targetUserId),
          status: {
            in: [InviteStatus.pending, InviteStatus.requested],
          },
          deletedAt: null,
        },
        data: {
          status: InviteStatus.canceled,
          updatedBy: auditUserId,
        },
      });

      return created;
    });

    this.publishEvent(
      KAFKA_TOPIC.PROJECT_MEMBER_ADDED,
      this.normalizeEntity(createdMember),
    );

    return this.hydrateMemberResponse(createdMember, fields);
  }

  async updateMember(
    projectId: string,
    memberId: string,
    dto: UpdateMemberDto,
    user: JwtUser,
    fields?: string,
  ): Promise<unknown> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedMemberId = this.parseId(memberId, 'Project member');
    const auditUserId = this.getAuditUserId(user);
    const actorUserId = this.getActorUserId(user);

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
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const existingMember = project.members.find(
      (member) => member.id === parsedMemberId,
    );

    if (!existingMember) {
      throw new NotFoundException(
        `Project member not found for project id ${projectId} and member id ${memberId}.`,
      );
    }

    const isOwnMember = String(existingMember.userId) === actorUserId;

    if (
      !isOwnMember &&
      !this.permissionService.hasNamedPermission(
        Permission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permission to update this project member.",
      );
    }

    if (existingMember.role !== dto.role) {
      const roles = await this.memberService.getUserRoles(
        existingMember.userId,
      );
      if (!validateUserHasProjectRole(dto.role, roles)) {
        throw new ForbiddenException(
          `User doesn't have required Topcoder roles to have project role "${dto.role}".`,
        );
      }
    }

    const shouldCompleteCopilotRequests =
      dto.action === 'complete-copilot-requests' &&
      existingMember.role === ProjectMemberRole.manager &&
      dto.role === ProjectMemberRole.copilot;

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.projectMember.updateMany({
          where: {
            projectId: parsedProjectId,
            role: dto.role,
            isPrimary: true,
            deletedAt: null,
            id: {
              not: parsedMemberId,
            },
          },
          data: {
            isPrimary: false,
            updatedBy: auditUserId,
          },
        });
      }

      const updated = await tx.projectMember.update({
        where: {
          id: parsedMemberId,
        },
        data: {
          role: dto.role,
          isPrimary:
            typeof dto.isPrimary === 'boolean' ? dto.isPrimary : undefined,
          updatedBy: auditUserId,
        },
      });

      if (shouldCompleteCopilotRequests) {
        await this.completeCopilotRequests(tx, parsedProjectId, updated.userId);
      }

      return updated;
    });

    return this.hydrateMemberResponse(updatedMember, fields);
  }

  async deleteMember(
    projectId: string,
    memberId: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedMemberId = this.parseId(memberId, 'Project member');
    const auditUserId = this.getAuditUserId(user);
    const actorUserId = this.getActorUserId(user);

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
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    const existingMember = project.members.find(
      (member) => member.id === parsedMemberId,
    );

    if (!existingMember) {
      throw new NotFoundException(
        `Project member not found for member id ${memberId}`,
      );
    }

    const isOwnMember = String(existingMember.userId) === actorUserId;

    if (!isOwnMember) {
      this.ensureDeletePermission(existingMember.role, user, project.members);
    }

    const deletedMember = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const deleted = await tx.projectMember.update({
        where: {
          id: parsedMemberId,
        },
        data: {
          deletedAt: now,
          deletedBy: BigInt(auditUserId),
          updatedBy: auditUserId,
        },
      });

      if (deleted.role === ProjectMemberRole.copilot && deleted.isPrimary) {
        const nextCopilot = await tx.projectMember.findFirst({
          where: {
            projectId: parsedProjectId,
            role: ProjectMemberRole.copilot,
            deletedAt: null,
            id: {
              not: deleted.id,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (nextCopilot) {
          await tx.projectMember.update({
            where: {
              id: nextCopilot.id,
            },
            data: {
              isPrimary: true,
              updatedBy: auditUserId,
            },
          });
        }
      }

      return deleted;
    });

    this.publishEvent(
      KAFKA_TOPIC.PROJECT_MEMBER_REMOVED,
      this.normalizeEntity(deletedMember),
    );
  }

  async listMembers(
    projectId: string,
    query: MemberListQueryDto,
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

    if (
      !this.permissionService.hasNamedPermission(
        Permission.READ_PROJECT_MEMBER,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
        role: query.role,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (members.length === 0) {
      return [];
    }

    return this.hydrateMemberListResponse(members, query.fields);
  }

  async getMember(
    projectId: string,
    memberId: string,
    query: GetMemberQueryDto,
    user: JwtUser,
  ): Promise<unknown> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedMemberId = this.parseId(memberId, 'Project member');

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

    if (
      !this.permissionService.hasNamedPermission(
        Permission.READ_PROJECT_MEMBER,
        user,
        project.members,
      )
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const member = await this.prisma.projectMember.findFirst({
      where: {
        id: parsedMemberId,
        projectId: parsedProjectId,
        deletedAt: null,
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Project member not found for project id ${projectId} and member id ${memberId}.`,
      );
    }

    return this.hydrateMemberResponse(member, query.fields);
  }

  private ensureDeletePermission(
    role: ProjectMemberRole,
    user: JwtUser,
    projectMembers: ProjectMember[],
  ): void {
    if (
      role !== ProjectMemberRole.customer &&
      role !== ProjectMemberRole.copilot &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_MEMBER_TOPCODER,
        user,
        projectMembers,
      )
    ) {
      throw new ForbiddenException(
        "You don't have permissions to delete other members from Topcoder Team.",
      );
    }

    if (
      role === ProjectMemberRole.customer &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_MEMBER_CUSTOMER,
        user,
        projectMembers,
      )
    ) {
      throw new ForbiddenException(
        'You don\'t have permissions to delete other members with "customer" role.',
      );
    }

    if (
      role === ProjectMemberRole.copilot &&
      !this.permissionService.hasNamedPermission(
        Permission.DELETE_PROJECT_MEMBER_COPILOT,
        user,
        projectMembers,
      )
    ) {
      throw new ForbiddenException(
        'You don\'t have permissions to delete other members with "copilot" role.',
      );
    }
  }

  private async completeCopilotRequests(
    tx: Prisma.TransactionClient,
    projectId: bigint,
    memberUserId: bigint,
  ): Promise<void> {
    const requests = await tx.copilotRequest.findMany({
      where: {
        projectId,
        status: {
          in: [
            CopilotRequestStatus.approved,
            CopilotRequestStatus.new,
            CopilotRequestStatus.seeking,
          ],
        },
        deletedAt: null,
        opportunities: {
          some: {
            deletedAt: null,
            applications: {
              some: {
                userId: memberUserId,
                deletedAt: null,
              },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (requests.length === 0) {
      return;
    }

    const requestIds = requests.map((request) => request.id);

    await tx.copilotRequest.updateMany({
      where: {
        id: {
          in: requestIds,
        },
      },
      data: {
        status: CopilotRequestStatus.fulfilled,
      },
    });

    const opportunities = await tx.copilotOpportunity.findMany({
      where: {
        copilotRequestId: {
          in: requestIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const opportunityIds = opportunities.map((opportunity) => opportunity.id);

    if (opportunityIds.length > 0) {
      await tx.copilotOpportunity.updateMany({
        where: {
          id: {
            in: opportunityIds,
          },
        },
        data: {
          status: CopilotOpportunityStatus.completed,
        },
      });

      const applications = await tx.copilotApplication.findMany({
        where: {
          opportunityId: {
            in: opportunityIds,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      const acceptedApplication = applications.find(
        (application) => application.userId === memberUserId,
      );
      const canceledApplicationIds = applications
        .filter((application) => application.userId !== memberUserId)
        .map((application) => application.id);

      if (canceledApplicationIds.length > 0) {
        await tx.copilotApplication.updateMany({
          where: {
            id: {
              in: canceledApplicationIds,
            },
          },
          data: {
            status: CopilotApplicationStatus.canceled,
          },
        });
      }

      if (acceptedApplication) {
        await tx.copilotApplication.update({
          where: {
            id: acceptedApplication.id,
          },
          data: {
            status: CopilotApplicationStatus.accepted,
          },
        });
      }
    }
  }

  private async hydrateMemberListResponse(
    members: ProjectMember[],
    fields?: string,
  ): Promise<unknown[]> {
    const requestedFields = this.parseFields(fields);

    const details =
      requestedFields.length > 0
        ? await this.memberService.getMemberDetailsByUserIds(
            members.map((member) => member.userId),
          )
        : [];

    return enrichMembersWithUserDetails(
      this.normalizeEntity(members),
      requestedFields,
      details,
    );
  }

  private async hydrateMemberResponse(
    member: ProjectMember,
    fields?: string,
  ): Promise<unknown> {
    const requestedFields = this.parseFields(fields);

    const details =
      requestedFields.length > 0
        ? await this.memberService.getMemberDetailsByUserIds([member.userId])
        : [];

    const [response] = enrichMembersWithUserDetails(
      [this.normalizeEntity(member)],
      requestedFields,
      details,
    );

    return response;
  }

  private parseId(value: string, label: string): bigint {
    const normalized = String(value || '').trim();
    if (!/^\d+$/.test(normalized)) {
      throw new BadRequestException(`${label} id must be a numeric string.`);
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

  private publishEvent(topic: string, payload: unknown): void {
    void publishMemberEvent(topic, payload).catch((error) => {
      this.logger.error(
        `Failed to publish member event topic=${topic}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    });
  }
}
