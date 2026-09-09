import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CopilotApplication,
  CopilotApplicationStatus,
  CopilotOpportunity,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
  CopilotRequest,
  CopilotRequestStatus,
  Prisma,
  ProjectMemberRole,
} from '@prisma/client';
import { Permission as NamedPermission } from 'src/shared/constants/permissions';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  parseOptionalBoolean,
  parseOptionalLooseInteger,
  parseOptionalStringArray,
} from 'src/shared/utils/dto-transform.utils';
import { CopilotNotificationService } from './copilot-notification.service';
import { AssignCopilotDto } from './dto/copilot-application.dto';
import {
  CopilotOpportunityResponseDto,
  ListOpportunitiesQueryDto,
} from './dto/copilot-opportunity.dto';
import {
  ensureNamedPermission,
  getAuditUserId,
  getCopilotRequestData,
  isAdminOrManager,
  normalizeEntity,
  parseNumericId,
  parseSortExpression,
} from './copilot.utils';

const OPPORTUNITY_SORTS = [
  'createdAt asc',
  'createdAt desc',
  'updatedAt asc',
  'updatedAt desc',
  'status asc',
  'status desc',
  'type asc',
  'type desc',
  'projectName asc',
  'projectName desc',
  'opportunityTitle asc',
  'opportunityTitle desc',
  'startDate asc',
  'startDate desc',
];

const MAX_OPPORTUNITY_PAGE_SIZE = 200;
const MAX_OPPORTUNITY_SEARCH_LENGTH = 200;
const MAX_OPPORTUNITY_SKILL_FILTERS = 50;

type OpportunityWithRelations = CopilotOpportunity & {
  copilotRequest?: CopilotRequest | null;
  project?: {
    id: bigint;
    name: string;
  } | null;
  applications?: Array<
    Pick<CopilotApplication, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  >;
};

type ApplicationWithMembership = CopilotApplication & {
  existingMembership?: {
    role: string;
  };
};

interface PaginatedOpportunityResponse {
  data: CopilotOpportunityResponseDto[];
  page: number;
  perPage: number;
  total: number;
}

interface OpportunityPageQueryRow {
  ids: string[];
  total: bigint | number;
}

interface NormalizedOpportunityQuery {
  page: number;
  perPage: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  noGrouping: boolean;
  search?: string;
  statuses?: CopilotOpportunityStatus[];
  projectId?: bigint;
  projectName?: string;
  types?: CopilotOpportunity['type'][];
  skills?: string[];
  startDateFrom?: string;
  startDateTo?: string;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  applied?: boolean;
  applicationStatuses?: CopilotApplicationStatus[];
  currentUserId?: bigint;
}

type PublicCopilotRequestData = Partial<
  Pick<
    CopilotOpportunityResponseDto,
    | 'opportunityTitle'
    | 'copilotUsername'
    | 'complexity'
    | 'requiresCommunication'
    | 'paymentType'
    | 'otherPaymentType'
    | 'projectType'
    | 'overview'
    | 'skills'
    | 'startDate'
    | 'numWeeks'
    | 'tzRestrictions'
    | 'numHoursPerWeek'
  >
>;

const PUBLIC_COPILOT_REQUEST_FIELDS = [
  'opportunityTitle',
  'copilotUsername',
  'complexity',
  'requiresCommunication',
  'paymentType',
  'otherPaymentType',
  'projectType',
  'overview',
  'skills',
  'startDate',
  'numWeeks',
  'tzRestrictions',
  'numHoursPerWeek',
] as const satisfies ReadonlyArray<keyof PublicCopilotRequestData>;

@Injectable()
/**
 * Manages copilot opportunity visibility, assignment, and cancellation.
 * listOpportunities and getOpportunity are intentionally open to authenticated users
 * so copilots can browse opportunities and apply.
 */
export class CopilotOpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly notificationService: CopilotNotificationService,
  ) {}

  /**
   * Lists copilot opportunities using database-side filtering, ordering, and
   * pagination.
   *
   * Filters cover free-text search, opportunity/application status, project,
   * type, skills, requested start date, creation date, and the current user's
   * applications. The default ordering retains the v5-compatible status
   * grouping (active, canceled, completed); `noGrouping=true` disables it.
   * A bounded second fetch loads only the selected page with response
   * relations, followed by one membership query for `canApplyAsCopilot`.
   *
   * @param query Validated discovery filters and pagination aliases.
   * @param user Authenticated JWT user, or undefined for anonymous `@Public()` callers.
   * @returns Paginated opportunity response payload and total matching count.
   * @throws BadRequestException If a filter, page size, sort, or date range is invalid.
   * @throws UnauthorizedException If a current-user application filter is requested without a numeric user id.
   */
  async listOpportunities(
    query: ListOpportunitiesQueryDto,
    user: JwtUser | undefined,
  ): Promise<PaginatedOpportunityResponse> {
    // TODO [SECURITY]: No permission check is applied here; this is intentional for authenticated browsing and should remain explicitly documented.
    const filters = this.normalizeOpportunityQuery(query, user);
    const includeProject = isAdminOrManager(user);
    const pageResult = await this.queryOpportunityPage(filters);
    const opportunityIds = pageResult.ids.map((id) => BigInt(id));

    const opportunities =
      opportunityIds.length > 0
        ? await this.prisma.copilotOpportunity.findMany({
            where: {
              id: {
                in: opportunityIds,
              },
              deletedAt: null,
            },
            include: {
              copilotRequest: true,
              project: includeProject
                ? {
                    select: {
                      id: true,
                      name: true,
                    },
                  }
                : false,
              applications: filters.currentUserId
                ? {
                    where: {
                      userId: filters.currentUserId,
                      deletedAt: null,
                    },
                    select: {
                      id: true,
                      status: true,
                      createdAt: true,
                      updatedAt: true,
                    },
                    orderBy: {
                      createdAt: 'desc',
                    },
                    take: 1,
                  }
                : false,
            },
          })
        : [];

    const opportunityById = new Map(
      opportunities.map((opportunity) => [
        opportunity.id.toString(),
        opportunity,
      ]),
    );
    const orderedOpportunities = pageResult.ids
      .map((id) => opportunityById.get(id))
      .filter((opportunity): opportunity is (typeof opportunities)[number] =>
        Boolean(opportunity),
      );

    const memberProjectIds = await this.getMembershipProjectIds(
      orderedOpportunities,
      user,
    );

    return {
      data: orderedOpportunities.map((opportunity) => {
        const formatted = this.formatOpportunity(
          opportunity,
          this.canApplyToOpportunity(opportunity, user, memberProjectIds),
          includeProject,
          Boolean(filters.currentUserId),
        );

        return formatted;
      }),
      page: filters.page,
      perPage: filters.perPage,
      total: pageResult.total,
    };
  }

  /**
   * Returns a single opportunity with eligibility context.
   * canApplyAsCopilot is true only for an authenticated human copilot with a
   * numeric user id who has not applied and is not already a project member.
   * Admin/manager responses also include minimal project metadata for v5 compatibility.
   *
   * @param opportunityId Opportunity id path value.
   * @param user Authenticated JWT user, or undefined for anonymous `@Public()` callers.
   * @returns One formatted opportunity response.
   * @throws BadRequestException If id is non-numeric.
   * @throws NotFoundException If opportunity does not exist.
   */
  async getOpportunity(
    opportunityId: string,
    user: JwtUser | undefined,
  ): Promise<CopilotOpportunityResponseDto> {
    // TODO [SECURITY]: No permission check is applied; any authenticated user can access any opportunity by id.
    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const includeProject = isAdminOrManager(user);
    const currentUserId = this.getNumericUserId(user);

    const opportunity = await this.prisma.copilotOpportunity.findFirst({
      where: {
        id: parsedOpportunityId,
        deletedAt: null,
      },
      include: {
        copilotRequest: true,
        project: includeProject
          ? {
              select: {
                id: true,
                name: true,
              },
            }
          : false,
        applications: currentUserId
          ? {
              where: {
                userId: currentUserId,
                deletedAt: null,
              },
              select: {
                id: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            }
          : false,
      },
    });

    if (!opportunity) {
      throw new NotFoundException(
        `Copilot opportunity with id ${opportunityId} was not found.`,
      );
    }

    const memberProjectIds = await this.getMembershipProjectIds(
      [opportunity],
      user,
    );

    return this.formatOpportunity(
      opportunity,
      this.canApplyToOpportunity(opportunity, user, memberProjectIds),
      includeProject,
      Boolean(currentUserId),
    );
  }

  /**
   * Assigns a selected copilot application to an active opportunity in one transaction:
   * 1) validate active opportunity with project
   * 2) validate application belongs to opportunity
   * 3) guard against double-accept
   * 4) upsert project member with copilot role
   * 5) accept selected application
   * 6) cancel other applications
   * 7) mark opportunity completed
   * 8) mark linked request fulfilled
   *
   * @param opportunityId Opportunity id path value.
   * @param dto Assignment payload with applicationId.
   * @param user Authenticated JWT user.
   * @returns Assigned application id payload.
   * @throws ForbiddenException If user lacks ASSIGN_COPILOT_OPPORTUNITY permission.
   * @throws NotFoundException If opportunity is not found.
   * @throws BadRequestException If ids are invalid, opportunity is inactive, or application is invalid/already accepted.
   */
  async assignCopilot(
    opportunityId: string,
    dto: AssignCopilotDto,
    user: JwtUser,
  ): Promise<{ id: string }> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.ASSIGN_COPILOT_OPPORTUNITY,
      user,
    );

    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const parsedApplicationId = parseNumericId(
      dto.applicationId,
      'Copilot application',
    );
    const auditUserId = getAuditUserId(user);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.copilotOpportunity.findFirst({
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

      if (!opportunity.projectId) {
        throw new BadRequestException(
          'Opportunity does not have an associated project.',
        );
      }

      const application = await tx.copilotApplication.findFirst({
        where: {
          id: parsedApplicationId,
          opportunityId: opportunity.id,
          deletedAt: null,
        },
      });

      if (!application) {
        throw new BadRequestException('No such application available.');
      }

      if (application.status === CopilotApplicationStatus.accepted) {
        throw new BadRequestException('Application already accepted.');
      }

      const activeMembers = await tx.projectMember.findMany({
        where: {
          projectId: opportunity.projectId,
          deletedAt: null,
        },
      });

      const existingMember = activeMembers.find(
        (member) => member.userId === application.userId,
      );

      if (existingMember) {
        if (
          existingMember.role !== ProjectMemberRole.copilot &&
          existingMember.role !== ProjectMemberRole.manager
        ) {
          // TODO [SECURITY]: Existing non-copilot/non-manager roles (for example customer) are silently upgraded to copilot without explicit confirmation or dedicated audit event.
          await tx.projectMember.update({
            where: {
              id: existingMember.id,
            },
            data: {
              role: ProjectMemberRole.copilot,
              updatedBy: auditUserId,
            },
          });
        }
      } else {
        await tx.projectMember.create({
          data: {
            projectId: opportunity.projectId,
            userId: application.userId,
            role: ProjectMemberRole.copilot,
            createdBy: auditUserId,
            updatedBy: auditUserId,
          },
        });
      }

      const acceptedApplication = await tx.copilotApplication.update({
        where: {
          id: application.id,
        },
        data: {
          status: CopilotApplicationStatus.accepted,
          updatedBy: auditUserId,
        },
      });

      const otherApplications = await tx.copilotApplication.findMany({
        where: {
          opportunityId: opportunity.id,
          deletedAt: null,
          id: {
            not: acceptedApplication.id,
          },
        },
      });

      if (otherApplications.length > 0) {
        await tx.copilotApplication.updateMany({
          where: {
            id: {
              in: otherApplications.map((item) => item.id),
            },
          },
          data: {
            status: CopilotApplicationStatus.canceled,
            updatedBy: auditUserId,
          },
        });
      }

      await tx.copilotOpportunity.update({
        where: {
          id: opportunity.id,
        },
        data: {
          status: CopilotOpportunityStatus.completed,
          updatedBy: auditUserId,
        },
      });

      if (opportunity.copilotRequestId) {
        await tx.copilotRequest.update({
          where: {
            id: opportunity.copilotRequestId,
          },
          data: {
            status: CopilotRequestStatus.fulfilled,
            updatedBy: auditUserId,
          },
        });
      }

      const appWithMembership: ApplicationWithMembership = {
        ...acceptedApplication,
      };

      if (existingMember) {
        appWithMembership.existingMembership = {
          role: existingMember.role,
        };
      }

      return {
        opportunity,
        acceptedApplication: appWithMembership,
        otherApplications,
        copilotRequest: opportunity.copilotRequest,
      };
    });

    await this.notificationService.sendCopilotAssignedNotification(
      assignment.opportunity,
      assignment.acceptedApplication,
      assignment.copilotRequest,
    );

    await this.notificationService.sendCopilotRejectedNotification(
      assignment.opportunity,
      assignment.otherApplications,
      assignment.copilotRequest,
    );

    return {
      id: dto.applicationId,
    };
  }

  /**
   * Cancels an opportunity and its applications in a transaction, then sends notifications.
   *
   * @param opportunityId Opportunity id path value.
   * @param user Authenticated JWT user.
   * @returns Canceled opportunity id payload.
   * @throws ForbiddenException If user lacks CANCEL_COPILOT_OPPORTUNITY permission.
   * @throws NotFoundException If opportunity is not found.
   * @throws BadRequestException If id is non-numeric.
   */
  async cancelOpportunity(
    opportunityId: string,
    user: JwtUser,
  ): Promise<{ id: string }> {
    ensureNamedPermission(
      this.permissionService,
      NamedPermission.CANCEL_COPILOT_OPPORTUNITY,
      user,
    );

    const parsedOpportunityId = parseNumericId(opportunityId, 'Opportunity');
    const auditUserId = getAuditUserId(user);

    const canceled = await this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.copilotOpportunity.findFirst({
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

      const applications = await tx.copilotApplication.findMany({
        where: {
          opportunityId: opportunity.id,
          deletedAt: null,
        },
      });

      if (applications.length > 0) {
        await tx.copilotApplication.updateMany({
          where: {
            id: {
              in: applications.map((application) => application.id),
            },
          },
          data: {
            status: CopilotApplicationStatus.canceled,
            updatedBy: auditUserId,
          },
        });
      }

      await tx.copilotOpportunity.update({
        where: {
          id: opportunity.id,
        },
        data: {
          status: CopilotOpportunityStatus.canceled,
          updatedBy: auditUserId,
        },
      });

      return {
        opportunity,
        applications,
      };
    });

    await this.notificationService.sendOpportunityCanceledNotification(
      canceled.opportunity,
      canceled.applications,
    );

    return {
      id: opportunityId,
    };
  }

  /**
   * Normalizes query aliases and validates values before they are bound to the
   * discovery SQL query.
   *
   * @param query Raw or class-transformed opportunity query DTO.
   * @param user Optional authenticated principal used for current-user filters.
   * @returns Canonical, typed filters with defaults applied.
   * @throws BadRequestException If pagination, enum values, lengths, sort, or date ranges are invalid.
   * @throws UnauthorizedException If application filtering is requested without a numeric user id.
   */
  private normalizeOpportunityQuery(
    query: ListOpportunitiesQueryDto,
    user: JwtUser | undefined,
  ): NormalizedOpportunityQuery {
    const page = this.normalizePositiveInteger(query.page, 'page', 1);
    const perPage = this.normalizePositiveInteger(
      query.pageSize ?? query.perPage,
      'pageSize',
      20,
      MAX_OPPORTUNITY_PAGE_SIZE,
    );
    const [sortField, sortDirection] = parseSortExpression(
      typeof query.sort === 'string' ? query.sort : undefined,
      OPPORTUNITY_SORTS,
      'createdAt desc',
    );
    const statuses = this.normalizeEnumFilter(
      query.status,
      Object.values(CopilotOpportunityStatus),
      'status',
    );
    const types = this.normalizeEnumFilter(
      [query.type, query.projectType],
      Object.values(CopilotOpportunityType),
      'type',
    );
    const applicationStatuses = this.normalizeEnumFilter(
      query.applicationStatus,
      Object.values(CopilotApplicationStatus),
      'applicationStatus',
    );
    const skills = parseOptionalStringArray([query.skills, query.skill]);
    const search = String(query.search ?? query.keyword ?? '').trim();
    const projectName = String(query.projectName ?? '').trim();
    const currentUserId = this.getNumericUserId(user);
    const appliedFilter = parseOptionalBoolean(query.applied);
    const myApplications = parseOptionalBoolean(query.myApplications);
    const applied =
      typeof appliedFilter === 'boolean'
        ? appliedFilter
        : myApplications === true
          ? true
          : undefined;

    if (search.length > MAX_OPPORTUNITY_SEARCH_LENGTH) {
      throw new BadRequestException(
        `search must not exceed ${MAX_OPPORTUNITY_SEARCH_LENGTH} characters.`,
      );
    }

    if (projectName.length > MAX_OPPORTUNITY_SEARCH_LENGTH) {
      throw new BadRequestException(
        `projectName must not exceed ${MAX_OPPORTUNITY_SEARCH_LENGTH} characters.`,
      );
    }

    if (skills && skills.length > MAX_OPPORTUNITY_SKILL_FILTERS) {
      throw new BadRequestException(
        `skills must contain no more than ${MAX_OPPORTUNITY_SKILL_FILTERS} values.`,
      );
    }

    if (applicationStatuses && applied === false) {
      throw new BadRequestException(
        'applicationStatus cannot be combined with applied=false.',
      );
    }

    if (
      (typeof applied === 'boolean' || Boolean(applicationStatuses)) &&
      !currentUserId
    ) {
      throw new UnauthorizedException(
        'Current-user application filters require an authenticated numeric user id.',
      );
    }

    const startDateFrom = this.normalizeDateBoundary(
      query.startDateFrom,
      'startDateFrom',
      false,
    );
    const startDateTo = this.normalizeDateBoundary(
      query.startDateTo,
      'startDateTo',
      true,
    );
    const createdAtFromValue = this.normalizeDateBoundary(
      query.createdAtFrom,
      'createdAtFrom',
      false,
    );
    const createdAtToValue = this.normalizeDateBoundary(
      query.createdAtTo,
      'createdAtTo',
      true,
    );

    if (
      startDateFrom &&
      startDateTo &&
      new Date(startDateFrom).getTime() > new Date(startDateTo).getTime()
    ) {
      throw new BadRequestException(
        'startDateFrom must be earlier than or equal to startDateTo.',
      );
    }

    if (
      createdAtFromValue &&
      createdAtToValue &&
      new Date(createdAtFromValue).getTime() >
        new Date(createdAtToValue).getTime()
    ) {
      throw new BadRequestException(
        'createdAtFrom must be earlier than or equal to createdAtTo.',
      );
    }

    const projectId = query.projectId
      ? parseNumericId(String(query.projectId), 'Project')
      : undefined;

    return {
      page,
      perPage,
      sortField,
      sortDirection,
      noGrouping: parseOptionalBoolean(query.noGrouping) ?? false,
      search: search || undefined,
      statuses,
      projectId,
      projectName: projectName || undefined,
      types,
      skills,
      startDateFrom,
      startDateTo,
      createdAtFrom: createdAtFromValue
        ? new Date(createdAtFromValue)
        : undefined,
      createdAtTo: createdAtToValue ? new Date(createdAtToValue) : undefined,
      applied,
      applicationStatuses,
      currentUserId,
    };
  }

  /**
   * Executes the database-side discovery query and returns only the selected
   * page of ids plus the total matching count.
   *
   * The raw SQL is required because legacy request attributes (title, skills,
   * and requested start date) are stored in JSONB. All user-controlled values
   * are parameter-bound through `Prisma.sql`; only allow-listed sort fragments
   * are composed as SQL syntax.
   *
   * @param filters Canonical filters produced by normalizeOpportunityQuery.
   * @returns Ordered opportunity ids for one page and the full filtered total.
   */
  private async queryOpportunityPage(
    filters: NormalizedOpportunityQuery,
  ): Promise<{ ids: string[]; total: number }> {
    const conditions = this.buildOpportunityConditions(filters);
    const orderBy = this.buildOpportunityOrderBy(filters);
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await this.prisma.$queryRaw<OpportunityPageQueryRow[]>(
      Prisma.sql`
        WITH filtered AS (
          SELECT
            o.id,
            o.status,
            o.type,
            o."createdAt",
            o."updatedAt",
            COALESCE(p.name, '') AS "projectName",
            COALESCE(r.data ->> 'opportunityTitle', '') AS "opportunityTitle",
            NULLIF(r.data ->> 'startDate', '') AS "startDate"
          FROM "copilot_opportunities" o
          LEFT JOIN "copilot_requests" r
            ON r.id = o."copilotRequestId"
          LEFT JOIN "projects" p
            ON p.id = o."projectId"
          WHERE ${Prisma.join(conditions, ' AND ')}
        )
        SELECT
          ARRAY(
            SELECT f.id::text
            FROM filtered f
            ORDER BY ${orderBy}
            LIMIT ${filters.perPage}
            OFFSET ${offset}
          ) AS ids,
          (SELECT COUNT(*)::bigint FROM filtered) AS total
      `,
    );

    const row = rows[0];
    const ids = Array.isArray(row?.ids)
      ? row.ids.filter((id) => /^\d+$/.test(String(id))).map(String)
      : [];

    return {
      ids,
      total: Number(row?.total ?? 0),
    };
  }

  /**
   * Builds parameterized SQL predicates for all opportunity discovery filters.
   *
   * @param filters Canonical filters produced by normalizeOpportunityQuery.
   * @returns SQL predicates joined by queryOpportunityPage with `AND`.
   */
  private buildOpportunityConditions(
    filters: NormalizedOpportunityQuery,
  ): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [Prisma.sql`o."deletedAt" IS NULL`];

    if (filters.statuses?.length) {
      conditions.push(
        Prisma.sql`(${Prisma.join(
          filters.statuses.map(
            (status) =>
              Prisma.sql`o.status = ${status}::"CopilotOpportunityStatus"`,
          ),
          ' OR ',
        )})`,
      );
    }

    if (filters.types?.length) {
      conditions.push(
        Prisma.sql`(${Prisma.join(
          filters.types.map(
            (type) => Prisma.sql`o.type = ${type}::"CopilotOpportunityType"`,
          ),
          ' OR ',
        )})`,
      );
    }

    if (filters.projectId) {
      conditions.push(Prisma.sql`o."projectId" = ${filters.projectId}`);
    }

    if (filters.projectName) {
      const pattern = `%${this.escapeLikePattern(
        filters.projectName.toLowerCase(),
      )}%`;
      conditions.push(
        Prisma.sql`LOWER(COALESCE(p.name, '')) LIKE ${pattern} ESCAPE E'\\\\'`,
      );
    }

    if (filters.search) {
      const pattern = `%${this.escapeLikePattern(filters.search.toLowerCase())}%`;
      // Some upgraded v5 databases retain this column as `json`; cast before
      // the JSONB-only skill operations so both physical types are supported.
      conditions.push(Prisma.sql`(
        LOWER(COALESCE(r.data ->> 'opportunityTitle', '')) LIKE ${pattern} ESCAPE E'\\\\'
        OR LOWER(COALESCE(r.data ->> 'overview', '')) LIKE ${pattern} ESCAPE E'\\\\'
        OR LOWER(COALESCE(p.name, '')) LIKE ${pattern} ESCAPE E'\\\\'
        OR LOWER(o.type::text) LIKE ${pattern} ESCAPE E'\\\\'
        OR LOWER(COALESCE(r.data::jsonb -> 'skills', '[]'::jsonb)::text) LIKE ${pattern} ESCAPE E'\\\\'
      )`);
    }

    if (filters.skills?.length) {
      const skills = filters.skills.map((skill) => skill.toLowerCase());
      conditions.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(r.data::jsonb -> 'skills') = 'array'
                THEN r.data::jsonb -> 'skills'
              ELSE '[]'::jsonb
            END
          ) AS requested_skill(value)
          WHERE LOWER(COALESCE(requested_skill.value ->> 'id', '')) IN (${Prisma.join(skills)})
             OR LOWER(COALESCE(requested_skill.value ->> 'name', '')) IN (${Prisma.join(skills)})
        )
      `);
    }

    if (filters.startDateFrom) {
      conditions.push(
        Prisma.sql`(r.data ->> 'startDate') >= ${filters.startDateFrom}`,
      );
    }

    if (filters.startDateTo) {
      conditions.push(
        Prisma.sql`(r.data ->> 'startDate') <= ${filters.startDateTo}`,
      );
    }

    if (filters.createdAtFrom) {
      conditions.push(Prisma.sql`o."createdAt" >= ${filters.createdAtFrom}`);
    }

    if (filters.createdAtTo) {
      conditions.push(Prisma.sql`o."createdAt" <= ${filters.createdAtTo}`);
    }

    if (
      filters.currentUserId &&
      (typeof filters.applied === 'boolean' ||
        Boolean(filters.applicationStatuses?.length))
    ) {
      const applicationConditions: Prisma.Sql[] = [
        Prisma.sql`a."opportunityId" = o.id`,
        Prisma.sql`a."userId" = ${filters.currentUserId}`,
        Prisma.sql`a."deletedAt" IS NULL`,
      ];

      if (filters.applicationStatuses?.length) {
        applicationConditions.push(
          Prisma.sql`(${Prisma.join(
            filters.applicationStatuses.map(
              (status) =>
                Prisma.sql`a.status = ${status}::"CopilotApplicationStatus"`,
            ),
            ' OR ',
          )})`,
        );
      }

      const applicationExists = Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "copilot_applications" a
          WHERE ${Prisma.join(applicationConditions, ' AND ')}
        )
      `;

      conditions.push(
        filters.applied === false
          ? Prisma.sql`NOT (${applicationExists})`
          : applicationExists,
      );
    }

    return conditions;
  }

  /**
   * Builds a stable, allow-listed SQL ordering fragment for the page query.
   *
   * @param filters Canonical sort field, direction, and grouping preference.
   * @returns SQL order expressions including an id tie-breaker.
   */
  private buildOpportunityOrderBy(
    filters: NormalizedOpportunityQuery,
  ): Prisma.Sql {
    let expression: Prisma.Sql;

    switch (filters.sortField) {
      case 'updatedAt':
        expression = Prisma.sql`f."updatedAt"`;
        break;
      case 'status':
        expression = Prisma.sql`f.status::text`;
        break;
      case 'type':
        expression = Prisma.sql`f.type::text`;
        break;
      case 'projectName':
        expression = Prisma.sql`NULLIF(LOWER(f."projectName"), '')`;
        break;
      case 'opportunityTitle':
        expression = Prisma.sql`NULLIF(LOWER(f."opportunityTitle"), '')`;
        break;
      case 'startDate':
        expression = Prisma.sql`f."startDate"`;
        break;
      default:
        expression = Prisma.sql`f."createdAt"`;
        break;
    }

    const directedOrder =
      filters.sortDirection === 'asc'
        ? Prisma.sql`${expression} ASC NULLS LAST`
        : Prisma.sql`${expression} DESC NULLS LAST`;
    const idOrder =
      filters.sortDirection === 'asc'
        ? Prisma.sql`f.id ASC`
        : Prisma.sql`f.id DESC`;

    if (filters.noGrouping) {
      return Prisma.sql`${directedOrder}, ${idOrder}`;
    }

    return Prisma.sql`
      CASE f.status::text
        WHEN 'active' THEN 0
        WHEN 'canceled' THEN 1
        WHEN 'completed' THEN 2
        ELSE 3
      END ASC,
      ${directedOrder},
      ${idOrder}
    `;
  }

  /**
   * Normalizes a positive integer query value while enforcing an optional cap.
   *
   * @param value Raw numeric query value.
   * @param label Parameter name used in validation errors.
   * @param defaultValue Value returned when the parameter is omitted.
   * @param maximum Optional inclusive maximum.
   * @returns A validated positive integer.
   * @throws BadRequestException If the value is not positive or exceeds maximum.
   */
  private normalizePositiveInteger(
    value: unknown,
    label: string,
    defaultValue: number,
    maximum?: number,
  ): number {
    const parsed = parseOptionalLooseInteger(value) ?? defaultValue;

    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 1 ||
      (maximum !== undefined && parsed > maximum)
    ) {
      const suffix = maximum ? ` and at most ${maximum}` : '';
      throw new BadRequestException(`${label} must be at least 1${suffix}.`);
    }

    return parsed;
  }

  /**
   * Parses and validates a string-list query against an enum allow-list.
   *
   * @param value Raw list, comma-separated string, or bracket-notation object.
   * @param allowedValues Allowed enum values.
   * @param label Parameter name used in validation errors.
   * @returns Unique typed enum values, or undefined when omitted.
   * @throws BadRequestException If any value is not in the allow-list.
   */
  private normalizeEnumFilter<T extends string>(
    value: unknown,
    allowedValues: readonly T[],
    label: string,
  ): T[] | undefined {
    const values = parseOptionalStringArray(value);

    if (!values) {
      return undefined;
    }

    const invalid = values.find(
      (valueItem) => !allowedValues.includes(valueItem as T),
    );

    if (invalid) {
      throw new BadRequestException(
        `Invalid ${label} value: ${invalid}. Allowed values: ${allowedValues.join(', ')}.`,
      );
    }

    return values as T[];
  }

  /**
   * Normalizes a date/date-time boundary to an RFC 3339 UTC timestamp.
   * Date-only upper bounds are expanded through the end of that UTC day.
   *
   * @param value Optional date or date-time string.
   * @param label Parameter name used in validation errors.
   * @param upperBoundary Whether a date-only value is an inclusive upper bound.
   * @returns ISO timestamp, or undefined when omitted.
   * @throws BadRequestException If the value is not a valid date.
   */
  private normalizeDateBoundary(
    value: unknown,
    label: string,
    upperBoundary: boolean,
  ): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${label} must be a valid ISO date.`);
    }

    const rawValue = value.trim();
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawValue);
    const normalizedInput = dateOnly
      ? `${rawValue}T${upperBoundary ? '23:59:59.999' : '00:00:00.000'}Z`
      : rawValue;
    const date = new Date(normalizedInput);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} must be a valid ISO date.`);
    }

    return date.toISOString();
  }

  /**
   * Resolves a numeric authenticated user id for application enrichment.
   *
   * @param user Optional JWT principal.
   * @returns BigInt user id, or undefined for anonymous/machine/non-numeric ids.
   */
  private getNumericUserId(user: JwtUser | undefined): bigint | undefined {
    const userId = String(user?.userId ?? '').trim();
    return /^\d+$/.test(userId) ? BigInt(userId) : undefined;
  }

  /**
   * Escapes PostgreSQL LIKE wildcard characters so discovery search treats
   * user input literally.
   *
   * @param value Lower-cased user search input.
   * @returns LIKE-safe text for use between `%` wildcards.
   */
  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  /**
   * Formats an opportunity response DTO.
   * Only explicitly public request-data fields are copied to the response;
   * trusted opportunity fields are assigned afterward so stored JSON cannot
   * override server-computed identity, status, eligibility, or application
   * state.
   *
   * @param input Opportunity row with relations.
   * @param canApplyAsCopilot Whether caller can apply.
   * @param includeProjectDetails Whether to include admin/manager project metadata.
   * @param includeCurrentUserApplication Whether to emit current-user application state.
   * @returns Formatted opportunity response.
   */
  private formatOpportunity(
    input: OpportunityWithRelations,
    canApplyAsCopilot: boolean,
    includeProjectDetails: boolean,
    includeCurrentUserApplication: boolean,
  ): CopilotOpportunityResponseDto {
    const normalized = normalizeEntity(input) as Record<string, any>;
    const requestData = this.getPublicCopilotRequestData(
      normalized.copilotRequest?.data as Prisma.JsonValue,
    );

    const response: CopilotOpportunityResponseDto = {
      ...requestData,
      id: String(normalized.id),
      copilotRequestId: normalized.copilotRequestId
        ? String(normalized.copilotRequestId)
        : undefined,
      status: normalized.status,
      type: normalized.type,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
      canApplyAsCopilot,
    };

    const projectId =
      normalized.projectId !== undefined && normalized.projectId !== null
        ? String(normalized.projectId)
        : normalized.project?.id !== undefined &&
            normalized.project?.id !== null
          ? String(normalized.project.id)
          : undefined;

    if (includeProjectDetails && projectId) {
      response.projectId = projectId;
    }

    if (
      includeProjectDetails &&
      projectId &&
      typeof normalized.project?.name === 'string'
    ) {
      response.project = {
        name: normalized.project.name,
      };
    }

    if (includeCurrentUserApplication) {
      const currentApplication = Array.isArray(normalized.applications)
        ? normalized.applications[0]
        : undefined;

      response.hasApplied = Boolean(currentApplication);

      if (currentApplication) {
        response.currentUserApplication = {
          id: String(currentApplication.id),
          status: currentApplication.status,
          createdAt: currentApplication.createdAt,
          updatedAt: currentApplication.updatedAt,
        };
      }
    }

    return response;
  }

  /**
   * Copies the public request-data contract from the JSON request envelope.
   * Database-only fields, unknown future keys, member identifiers, and keys
   * that could collide with trusted opportunity metadata are omitted.
   *
   * @param value Copilot request JSON stored with the opportunity.
   * @returns A new object containing only documented public request fields.
   * @throws Does not throw.
   */
  private getPublicCopilotRequestData(
    value: Prisma.JsonValue | null | undefined,
  ): PublicCopilotRequestData {
    const requestData = getCopilotRequestData(value);
    const publicData: Record<string, unknown> = {};

    for (const field of PUBLIC_COPILOT_REQUEST_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(requestData, field)) {
        publicData[field] = requestData[field];
      }
    }

    return publicData;
  }

  /**
   * Determines whether a caller can create a new copilot application.
   * Eligibility mirrors the protected apply route and application service:
   * callers must be authenticated human copilots with numeric ids, the
   * opportunity must be active, and neither a current application nor project
   * membership may exist.
   *
   * @param opportunity Opportunity and optional current-user application row.
   * @param user Optional authenticated principal.
   * @param memberProjectIds Project ids where the current user is a member.
   * @returns True when the caller can create a new application.
   * @throws Does not throw.
   */
  private canApplyToOpportunity(
    opportunity: OpportunityWithRelations,
    user: JwtUser | undefined,
    memberProjectIds: Set<string>,
  ): boolean {
    const projectId = opportunity.projectId?.toString();

    return Boolean(
      this.isCopilotApplicant(user) &&
      opportunity.status === CopilotOpportunityStatus.active &&
      projectId &&
      !memberProjectIds.has(projectId) &&
      !opportunity.applications?.length,
    );
  }

  /**
   * Checks whether the principal can satisfy the copilot-only apply route.
   *
   * @param user Optional authenticated principal.
   * @returns True for human copilot-role users with numeric Topcoder ids.
   * @throws Does not throw.
   */
  private isCopilotApplicant(user: JwtUser | undefined): boolean {
    return Boolean(
      user &&
      !user.isMachine &&
      this.getNumericUserId(user) !== undefined &&
      user.roles?.includes(UserRole.TC_COPILOT),
    );
  }

  /**
   * Resolves project ids where the current user is already a member.
   * Returns early for principals that cannot use the copilot-only apply route
   * and performs one batch membership query for eligible callers.
   *
   * @param opportunities Opportunity rows used to collect project ids.
   * @param user Authenticated JWT user.
   * @returns Set of project ids where membership exists.
   */
  private async getMembershipProjectIds(
    opportunities: CopilotOpportunity[],
    user: JwtUser | undefined,
  ): Promise<Set<string>> {
    const currentUserId = this.getNumericUserId(user);
    if (!this.isCopilotApplicant(user) || currentUserId === undefined) {
      return new Set<string>();
    }

    const projectIds = opportunities
      .map((opportunity) => opportunity.projectId)
      .filter((projectId): projectId is bigint => Boolean(projectId));

    if (projectIds.length === 0) {
      return new Set<string>();
    }

    const memberships = await this.prisma.projectMember.findMany({
      where: {
        userId: currentUserId,
        projectId: {
          in: projectIds,
        },
        deletedAt: null,
      },
      select: {
        projectId: true,
      },
    });

    return new Set(
      memberships.map((membership) => membership.projectId.toString()),
    );
  }
}
