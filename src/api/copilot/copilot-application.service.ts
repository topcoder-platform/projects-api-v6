import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CopilotApplication,
  CopilotApplicationStatus,
  CopilotOpportunity,
  CopilotOpportunityStatus,
  ProjectMember,
} from '@prisma/client';
import { Permission as NamedPermission } from 'src/shared/constants/permissions';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { CopilotNotificationService } from './copilot-notification.service';
import {
  CopilotApplicationListQueryDto,
  CopilotApplicationResponseDto,
  CreateCopilotApplicationDto,
} from './dto/copilot-application.dto';
import {
  ensureNamedPermission,
  isAdminOrPm,
  normalizeEntity,
  parseNumericId,
  parseSortExpression,
} from './copilot.utils';

const APPLICATION_SORTS = ['createdAt asc', 'createdAt desc'];

type ApplicationWithRelations = CopilotApplication & {
  opportunity?: CopilotOpportunity | null;
};

@Injectable()
/**
 * Handles copilot applications: submit, list with role-based field filtering,
 * and numeric user-id validation via parseUserId.
 */
export class CopilotApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly notificationService: CopilotNotificationService,
  ) {}

  /**
   * Applies the current user to an active opportunity.
   * Idempotent behavior: returns existing application if already present for this user/opportunity.
   *
   * @param opportunityId Opportunity id path value.
   * @param dto Application payload.
   * @param user Authenticated JWT user.
   * @returns Created or existing copilot application response.
   * @throws ForbiddenException If user lacks APPLY_COPILOT_OPPORTUNITY permission.
   * @throws NotFoundException If opportunity is not found.
   * @throws BadRequestException If ids are invalid or opportunity is not active.
   */
  async applyToOpportunity(
    opportunityId: string,
    dto: CreateCopilotApplicationDto,
    user: JwtUser,
  ): Promise<CopilotApplicationResponseDto> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.APPLY_COPILOT_OPPORTUNITY,
      user,
    );

    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const parsedUserId = this.parseUserId(user);

    const opportunity = await this.prisma.copilotOpportunity.findFirst({
      where: {
        id: parsedOpportunityId,
        deletedAt: null,
      },
      include: {
        copilotRequest: true,
      },
    });

    if (!opportunity) {
      throw new NotFoundException(
        `Copilot opportunity with id ${opportunityId} was not found.`,
      );
    }

    if (opportunity.status !== CopilotOpportunityStatus.active) {
      throw new BadRequestException('Opportunity is not active.');
    }

    const existing = await this.prisma.copilotApplication.findFirst({
      where: {
        opportunityId: opportunity.id,
        userId: parsedUserId,
        deletedAt: null,
      },
    });

    if (existing) {
      return this.formatApplication(existing);
    }

    const created = await this.prisma.copilotApplication.create({
      data: {
        opportunityId: opportunity.id,
        userId: parsedUserId,
        notes: dto.notes,
        status: CopilotApplicationStatus.pending,
        // TODO [QUALITY]: createdBy/updatedBy bypass parseUserId and parse directly; use getAuditUserId(user) from copilot.utils.ts for consistency.
        createdBy: Number.parseInt(user.userId as string, 10),
        updatedBy: Number.parseInt(user.userId as string, 10),
      },
    });

    await this.notificationService.sendCopilotApplicationNotification(
      opportunity,
      created,
    );

    return this.formatApplication(created);
  }

  /**
   * Lists applications for one opportunity.
   * Admin/PM users receive full CopilotApplicationResponseDto rows.
   * Other users receive limited fields: userId, status, and createdAt.
   * existingMembership is enriched from a separate projectMember query.
   *
   * @param opportunityId Opportunity id path value.
   * @param query Pagination and sort parameters.
   * @param user Authenticated JWT user.
   * @returns Full or limited application list depending on caller role.
   * @throws NotFoundException If opportunity is not found.
   * @throws BadRequestException If opportunityId is non-numeric.
   */
  async listApplications(
    opportunityId: string,
    query: CopilotApplicationListQueryDto,
    user: JwtUser,
  ): Promise<
    | CopilotApplicationResponseDto[]
    | Array<
        Pick<CopilotApplicationResponseDto, 'userId' | 'status' | 'createdAt'>
      >
  > {
    // TODO [QUALITY]: Controller return type is unknown and this service returns a union; consider discriminated union or single response shape with optional fields.
    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const [sortField, sortDirection] = parseSortExpression(
      query.sort,
      APPLICATION_SORTS,
      'createdAt desc',
    );

    const opportunity = await this.prisma.copilotOpportunity.findFirst({
      where: {
        id: parsedOpportunityId,
        deletedAt: null,
      },
    });

    if (!opportunity) {
      throw new NotFoundException('No opportunity found.');
    }

    const applications = await this.prisma.copilotApplication.findMany({
      where: {
        opportunityId: parsedOpportunityId,
        deletedAt: null,
      },
      include: {
        opportunity: true,
      },
      orderBy: {
        [sortField]: sortDirection,
      },
    });

    const page = query.page || 1;
    const perPage = query.pageSize || 20;
    const start = (page - 1) * perPage;
    const end = start + perPage;

    const members = await this.prisma.projectMember.findMany({
      where: {
        projectId: opportunity.projectId || BigInt(-1),
        deletedAt: null,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    const memberByUserId = new Map<string, ProjectMember>();
    members.forEach((member) => {
      memberByUserId.set(member.userId.toString(), member as ProjectMember);
    });

    const normalizedApplications = applications
      .slice(start, end)
      .map((application) => {
        const response = this.formatApplication(
          application as ApplicationWithRelations,
        );

        const membership = memberByUserId.get(response.userId);
        if (membership) {
          response.existingMembership = {
            role: membership.role,
          };
        }

        return response;
      });

    if (isAdminOrPm(user)) {
      return normalizedApplications;
    }

    return normalizedApplications.map((application) => ({
      userId: application.userId,
      status: application.status,
      createdAt: application.createdAt,
    }));
  }

  /**
   * Formats an application entity into response DTO shape.
   * Applies bigint-to-string normalization through normalizeEntity.
   *
   * @param input Copilot application entity.
   * @returns Formatted copilot application response.
   */
  private formatApplication(
    input: CopilotApplication,
  ): CopilotApplicationResponseDto {
    const normalized = normalizeEntity(input) as Record<string, any>;

    return {
      id: String(normalized.id),
      opportunityId: String(normalized.opportunityId),
      userId: String(normalized.userId),
      notes: normalized.notes,
      status: normalized.status,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    };
  }

  /**
   * Parses and validates authenticated user id as bigint.
   *
   * @param user Authenticated JWT user.
   * @returns Parsed numeric user id as bigint.
   * @throws BadRequestException If user id is non-numeric.
   */
  private parseUserId(user: JwtUser): bigint {
    const normalized = String(user.userId || '').trim();

    if (!/^\d+$/.test(normalized)) {
      throw new BadRequestException('Authenticated user id must be numeric.');
    }

    return BigInt(normalized);
  }
}
