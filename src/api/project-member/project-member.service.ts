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
import { publishMemberEventSafely } from 'src/shared/utils/event.utils';
import { normalizeEntity as normalizePrismaEntity } from 'src/shared/utils/entity.utils';
import {
  getActorUserId as getActorUserIdFromJwt,
  getAuditUserId as getAuditUserIdFromJwt,
  ensureRoleScopedPermission,
  parseCsvFields,
  parseNumericStringId,
} from 'src/shared/utils/service.utils';

/**
 * Manages the project member lifecycle: add, update, delete, list, and get.
 *
 * The service enforces permissions through `PermissionService`, validates
 * Topcoder roles through `MemberService`, and publishes member events through
 * `publishMemberEvent`.
 *
 * Member creation also cancels open invites for the same user in a
 * transaction. A manager-to-copilot promotion with
 * `action: complete-copilot-requests` completes open copilot workflow records
 * atomically.
 */
@Injectable()
export class ProjectMemberService {
  private readonly logger = LoggerService.forRoot('ProjectMemberService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly memberService: MemberService,
  ) {}

  /**
   * Adds a member to a project.
   *
   * @param projectId Project identifier.
   * @param dto Member creation payload.
   * @param user Authenticated caller.
   * @param fields Optional CSV list of additional member profile fields.
   * @returns The created member response enriched with requested fields.
   * @throws {NotFoundException} If the project cannot be found.
   * @throws {ForbiddenException} If permissions or role constraints fail.
   * @throws {BadRequestException} If ids are invalid or role cannot be resolved.
   * @throws {ConflictException} If the target user is already a member.
   */
  async addMember(
    projectId: string,
    dto: CreateMemberDto,
    user: JwtUser,
    fields?: string,
  ): Promise<unknown> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const auditUserId = this.getAuditUserId(user);
    const actorUserId = this.getActorUserId(user);
    const targetUserId = this.resolveTargetUserId(dto.userId, actorUserId);

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

  /**
   * Updates a project member.
   *
   * @param projectId Project identifier.
   * @param memberId Member identifier.
   * @param dto Member update payload.
   * @param user Authenticated caller.
   * @param fields Optional CSV list of additional member profile fields.
   * @returns The updated member response enriched with requested fields.
   * @throws {NotFoundException} If the project or member cannot be found.
   * @throws {ForbiddenException} If permissions or role constraints fail.
   * @throws {BadRequestException} If ids are invalid.
   */
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

  /**
   * Deletes a project member by soft-deleting the member record.
   *
   * @param projectId Project identifier.
   * @param memberId Member identifier.
   * @param user Authenticated caller.
   * @returns Resolves when deletion logic and follow-up updates complete.
   * @throws {NotFoundException} If the project or member cannot be found.
   * @throws {ForbiddenException} If role-specific delete permission is missing.
   * @throws {BadRequestException} If ids are invalid.
   */
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

  /**
   * Lists project members optionally filtered by role and enriched fields.
   *
   * @param projectId Project identifier.
   * @param query Member list query parameters.
   * @param user Authenticated caller.
   * @returns A list of serialized member records.
   * @throws {NotFoundException} If the project cannot be found.
   * @throws {ForbiddenException} If read permission is missing.
   * @throws {BadRequestException} If ids are invalid.
   */
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

  /**
   * Gets a single member by project and member ids.
   *
   * @param projectId Project identifier.
   * @param memberId Member identifier.
   * @param query Member query parameters.
   * @param user Authenticated caller.
   * @returns A serialized member record.
   * @throws {NotFoundException} If the project or member cannot be found.
   * @throws {ForbiddenException} If read permission is missing.
   * @throws {BadRequestException} If ids are invalid.
   */
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

  /**
   * Enforces role-specific permissions when deleting another member.
   *
   * @param role Role of the member being deleted.
   * @param user Authenticated caller.
   * @param projectMembers Current active project members for permission checks.
   * @returns Nothing.
   * @throws {ForbiddenException} If role-specific delete permission is missing.
   */
  private ensureDeletePermission(
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
        permission: Permission.DELETE_PROJECT_MEMBER_TOPCODER,
        message:
          "You don't have permissions to delete other members from Topcoder Team.",
      },
      {
        [ProjectMemberRole.customer]: {
          permission: Permission.DELETE_PROJECT_MEMBER_CUSTOMER,
          message:
            'You don\'t have permissions to delete other members with "customer" role.',
        },
        [ProjectMemberRole.copilot]: {
          permission: Permission.DELETE_PROJECT_MEMBER_COPILOT,
          message:
            'You don\'t have permissions to delete other members with "copilot" role.',
        },
      },
    );
  }

  /**
   * Completes open copilot workflow records for a promoted copilot member.
   *
   * @param tx Active transaction client.
   * @param projectId Project identifier.
   * @param memberUserId User id of the promoted member.
   * @returns Resolves when workflow updates are applied.
   * @throws {Prisma.PrismaClientKnownRequestError} If transaction operations
   * fail due to database constraints.
   */
  // TODO: QUALITY: This intentionally performs sequential queries in one
  // transaction for atomicity, but can create N+1-like load with large
  // `requestIds`; consider batching opportunity/application fetches.
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

  /**
   * Enriches a list of members with optional profile fields.
   *
   * @param members Member entities.
   * @param fields Optional CSV list of additional profile fields.
   * @returns Enriched member response objects.
   * @throws {BadRequestException} If field parsing fails validation.
   */
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

  /**
   * Enriches a single member with optional profile fields.
   *
   * @param member Member entity.
   * @param fields Optional CSV list of additional profile fields.
   * @returns Enriched member response object.
   * @throws {BadRequestException} If field parsing fails validation.
   */
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

  /**
   * Parses and validates a numeric id value.
   *
   * @param value Raw id string.
   * @param label Friendly entity label for error messages.
   * @returns Parsed bigint id.
   * @throws {BadRequestException} If the id is not numeric.
   */
  private parseId(value: string, label: string): bigint {
    return parseNumericStringId(value, `${label} id`);
  }

  /**
   * Resolves the target project-member user id from request payload state.
   *
   * Defaults to the authenticated actor when `dto.userId` is omitted, and
   * rejects provided values that are not numeric.
   *
   * @param userId Raw `CreateMemberDto.userId` payload value.
   * @param actorUserId Authenticated caller id used as the default target.
   * @returns Normalized target user id string.
   * @throws {BadRequestException} If a provided `userId` is not numeric.
   */
  private resolveTargetUserId(
    userId: CreateMemberDto['userId'] | string | bigint | null | undefined,
    actorUserId: string,
  ): string {
    if (typeof userId === 'undefined' || userId === null) {
      return actorUserId;
    }

    if (typeof userId === 'number') {
      if (!Number.isFinite(userId)) {
        throw new BadRequestException('User id must be a numeric string.');
      }

      return parseNumericStringId(
        String(Math.trunc(userId)),
        'User id',
      ).toString();
    }

    if (typeof userId === 'string' || typeof userId === 'bigint') {
      return parseNumericStringId(String(userId), 'User id').toString();
    }

    throw new BadRequestException('User id must be a numeric string.');
  }

  /**
   * Resolves the authenticated actor id as a trimmed string.
   *
   * @param user Authenticated caller.
   * @returns Normalized user id string.
   * @throws {ForbiddenException} If the user id is missing.
   */
  private getActorUserId(user: JwtUser): string {
    return getActorUserIdFromJwt(user);
  }

  /**
   * Resolves the authenticated actor id as a numeric audit id.
   *
   * @param user Authenticated caller.
   * @returns Numeric user id used for audit columns.
   * @throws {ForbiddenException} If the user id is missing or non-numeric.
   */
  private getAuditUserId(user: JwtUser): number {
    return getAuditUserIdFromJwt(user);
  }

  /**
   * Parses a CSV list of additional member fields.
   *
   * @param fields Raw CSV string.
   * @returns Normalized list of field names.
   * @throws {BadRequestException} When field input fails validation.
   */
  private parseFields(fields?: string): string[] {
    return parseCsvFields(fields);
  }

  /**
   * Converts entity payloads into API-safe primitives.
   *
   * @param payload Payload containing Prisma entities.
   * @returns Payload with bigint/decimal values normalized.
   * @throws {TypeError} If recursive traversal encounters unsupported values.
   */
  private normalizeEntity<T>(payload: T): T {
    return normalizePrismaEntity(payload);
  }

  /**
   * Publishes a member-related Kafka event with defensive logging.
   *
   * @param topic Kafka topic name.
   * @param payload Event payload.
   * @returns Nothing.
   * @throws {Error} The underlying publisher may reject and is handled here.
   */
  private publishEvent(topic: string, payload: unknown): void {
    publishMemberEventSafely(topic, payload, this.logger);
  }
}
