/**
 * Project query-building and response-filtering helpers.
 *
 * Used by project services to construct Prisma `where`/`include` clauses and to
 * filter nested resources based on caller permissions.
 */
import { Prisma, ProjectStatus } from '@prisma/client';
import { ProjectListQueryDto } from 'src/api/project/dto/project-list-query.dto';
import { PROJECT_MEMBER_MANAGER_ROLES } from 'src/shared/enums/projectMemberRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';

/**
 * Flags representing requested project response sub-resources.
 */
export interface ParsedProjectFields {
  projects: boolean;
  project_members: boolean;
  project_member_invites: boolean;
  attachments: boolean;
  raw: string[];
}

/**
 * Default field selection used when no `fields` query param is provided.
 */
const DEFAULT_FIELDS: ParsedProjectFields = {
  projects: true,
  project_members: true,
  project_member_invites: true,
  attachments: true,
  raw: [],
};

/**
 * Normalizes string comparisons.
 *
 * @todo Duplicate helper exists in other shared modules (including
 * `normalize` variants in permission/member utilities). Consolidate in a
 * single shared string utility.
 */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalizes user ids to trimmed string form.
 *
 * @todo Duplicate helper exists in other shared modules (including
 * `src/shared/utils/member.utils.ts#normalizeUserId`). Consolidate user-id
 * normalization in one shared utility.
 */
function normalizeUserId(
  value: string | number | bigint | null | undefined,
): string {
  if (typeof value === 'undefined' || value === null) {
    return '';
  }

  return String(value).trim();
}

/**
 * Parses comma-separated values into a trimmed non-empty string list.
 */
function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Normalizes query filter values from scalar/array/object representations.
 *
 * Supports plain strings, arrays, and object forms with `$in` or `in`.
 */
function parseFilterValue(value: unknown): string[] {
  if (typeof value === 'string') {
    return parseCsv(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;

    if (typeof input.$in === 'string') {
      return parseCsv(input.$in);
    }

    if (Array.isArray(input.$in)) {
      return input.$in
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0);
    }

    if (typeof input.in === 'string') {
      return parseCsv(input.in);
    }

    if (Array.isArray(input.in)) {
      return input.in
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0);
    }
  }

  return [];
}

/**
 * Safely converts a string to bigint.
 *
 * Returns `null` for invalid bigint input.
 */
function toBigInt(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Appends a new condition into a Prisma `AND` clause.
 */
function appendAndCondition(
  where: Prisma.ProjectWhereInput,
  condition: Prisma.ProjectWhereInput,
): void {
  if (!where.AND) {
    where.AND = [condition];
    return;
  }

  if (Array.isArray(where.AND)) {
    where.AND = [...where.AND, condition];
    return;
  }

  where.AND = [where.AND, condition];
}

/**
 * Converts list of string ids into valid bigint values.
 */
function toBigIntList(values: string[]): bigint[] {
  return values
    .map((value) => toBigInt(value))
    .filter((value): value is bigint => value !== null);
}

/**
 * Parses and validates project status values against Prisma enum values.
 */
function parseProjectStatus(values: string[]): ProjectStatus[] {
  const allowed = new Set(Object.values(ProjectStatus));

  return values
    .map((value) => normalize(value))
    .filter((value): value is ProjectStatus =>
      allowed.has(value as ProjectStatus),
    );
}

/**
 * Parses the `fields` query parameter into include flags.
 *
 * `projects` is always true. `all` enables all optional sub-resources.
 */
export function parseFieldsParameter(fields?: string): ParsedProjectFields {
  if (!fields || fields.trim().length === 0) {
    return {
      ...DEFAULT_FIELDS,
      raw: [],
    };
  }

  const parsed = parseCsv(fields);

  const tokens = new Set(parsed.map((entry) => normalize(entry)));

  return {
    projects: true,
    project_members:
      tokens.has('project_members') ||
      tokens.has('members') ||
      tokens.has('all'),
    project_member_invites:
      tokens.has('project_member_invites') ||
      tokens.has('invites') ||
      tokens.has('all'),
    attachments: tokens.has('attachments') || tokens.has('all'),
    raw: parsed,
  };
}

/**
 * Builds Prisma `where` clause for project list filtering.
 *
 * Filters supported:
 * - `id`, `status`, `billingAccountId`, `type`: exact or multi-value `in`.
 * - `name`: case-insensitive contains match.
 * - `directProjectId`: exact bigint match.
 * - `keyword`: full-text search (`search`) plus case-insensitive contains on
 * name and description.
 * - `code`: case-insensitive contains on name.
 * - `customer` / `manager`: member-subquery constraints.
 * - non-admin or `memberOnly=true`: restrict to membership/invite ownership.
 */
export function buildProjectWhereClause(
  criteria: ProjectListQueryDto,
  user: JwtUser,
  isAdmin: boolean,
): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {
    deletedAt: null,
  };

  const idFilter = parseFilterValue(criteria.id);
  if (idFilter.length > 0) {
    const idList = toBigIntList(idFilter);

    if (idList.length === 1) {
      where.id = idList[0];
    } else if (idList.length > 1) {
      where.id = {
        in: idList,
      };
    }
  }

  const statusFilter = parseFilterValue(criteria.status);
  if (statusFilter.length > 0) {
    const statuses = parseProjectStatus(statusFilter);

    if (statuses.length === 1) {
      where.status = statuses[0];
    } else if (statuses.length > 1) {
      where.status = {
        in: statuses,
      };
    }
  }

  const billingAccountIdFilter = parseFilterValue(criteria.billingAccountId);
  if (billingAccountIdFilter.length > 0) {
    const billingAccountIds = toBigIntList(billingAccountIdFilter);

    if (billingAccountIds.length === 1) {
      where.billingAccountId = billingAccountIds[0];
    } else if (billingAccountIds.length > 1) {
      where.billingAccountId = {
        in: billingAccountIds,
      };
    }
  }

  const typeFilter = parseFilterValue(criteria.type);
  if (typeFilter.length > 0) {
    if (typeFilter.length === 1) {
      where.type = typeFilter[0];
    } else {
      where.type = {
        in: typeFilter,
      };
    }
  }

  if (criteria.name) {
    where.name = {
      contains: criteria.name,
      mode: 'insensitive',
    };
  }

  if (criteria.directProjectId) {
    const parsedDirectProjectId = toBigInt(criteria.directProjectId);

    if (parsedDirectProjectId) {
      where.directProjectId = parsedDirectProjectId;
    }
  }

  if (criteria.keyword) {
    const keyword = criteria.keyword.trim();

    if (keyword.length > 0) {
      appendAndCondition(where, {
        OR: [
          {
            name: {
              search: keyword,
            },
          },
          {
            description: {
              search: keyword,
            },
          },
          {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        ],
      });
    }
  }

  if (criteria.code) {
    appendAndCondition(where, {
      name: {
        contains: criteria.code,
        mode: 'insensitive',
      },
    });
  }

  if (criteria.customer) {
    const customerId = toBigInt(criteria.customer);

    if (customerId) {
      appendAndCondition(where, {
        members: {
          some: {
            userId: customerId,
            role: 'customer',
            deletedAt: null,
          },
        },
      });
    }
  }

  if (criteria.manager) {
    const managerId = toBigInt(criteria.manager);

    if (managerId) {
      appendAndCondition(where, {
        members: {
          some: {
            userId: managerId,
            role: {
              in: PROJECT_MEMBER_MANAGER_ROLES,
            },
            deletedAt: null,
          },
        },
      });
    }
  }

  const memberOnly = criteria.memberOnly === true;

  if (!isAdmin || memberOnly) {
    const userId = toBigInt(normalizeUserId(user.userId));

    if (userId) {
      appendAndCondition(where, {
        OR: [
          {
            members: {
              some: {
                userId,
                deletedAt: null,
              },
            },
          },
          {
            invites: {
              some: {
                userId,
                status: 'pending',
                deletedAt: null,
              },
            },
          },
        ],
      });
    }
  }

  return where;
}

/**
 * Builds Prisma `include` clause from parsed field flags.
 *
 * Included sub-resources are soft-delete aware and ordered by `id asc`.
 */
export function buildProjectIncludeClause(
  fields: ParsedProjectFields,
): Prisma.ProjectInclude {
  const include: Prisma.ProjectInclude = {};

  if (fields.project_members) {
    include.members = {
      where: {
        deletedAt: null,
      },
      orderBy: {
        id: 'asc',
      },
    };
  }

  if (fields.project_member_invites) {
    include.invites = {
      where: {
        deletedAt: null,
      },
      orderBy: {
        id: 'asc',
      },
    };
  }

  if (fields.attachments) {
    include.attachments = {
      where: {
        deletedAt: null,
      },
      orderBy: {
        id: 'asc',
      },
    };
  }

  return include;
}

type InviteLike = {
  userId?: string | number | bigint | null;
};

/**
 * Filters project invites according to permission flags.
 *
 * Returns:
 * - all invites when `hasReadAll` is true,
 * - only own invites when `hasReadOwn` is true,
 * - empty list otherwise.
 */
export function filterInvitesByPermission<T extends InviteLike>(
  invites: T[] | undefined,
  user: JwtUser,
  hasReadAll: boolean,
  hasReadOwn: boolean,
): T[] {
  if (!invites || invites.length === 0) {
    return [];
  }

  if (hasReadAll) {
    return invites;
  }

  if (!hasReadOwn) {
    return [];
  }

  const normalizedUserId = normalizeUserId(user.userId);

  return invites.filter((invite) => {
    if (!invite.userId) {
      return false;
    }

    return normalizeUserId(invite.userId) === normalizedUserId;
  });
}

type AttachmentLike = {
  createdBy?: string | number | bigint | null;
  allowedUsers?: number[];
};

type ProjectMemberLike = {
  userId?: string | number | bigint | null;
  role?: string | null;
};

/**
 * Filters attachments by caller visibility rules.
 *
 * Visibility:
 * - admins and management-role members can view all attachments,
 * - others can view own attachments,
 * - others can view attachments with empty `allowedUsers`,
 * - others can view attachments where their numeric user id is in
 * `allowedUsers`.
 *
 * @security Empty `allowedUsers` means "public within the project".
 */
export function filterAttachmentsByPermission<T extends AttachmentLike>(
  attachments: T[] | undefined,
  user: JwtUser,
  projectMembers: ProjectMemberLike[] = [],
  isAdmin = false,
): T[] {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const normalizedUserId = normalizeUserId(user.userId);

  const isManagementMember = projectMembers.some((member) => {
    if (normalizeUserId(member.userId) !== normalizedUserId) {
      return false;
    }

    if (!member.role) {
      return false;
    }

    return PROJECT_MEMBER_MANAGER_ROLES.includes(member.role as any);
  });

  if (isAdmin || isManagementMember) {
    return attachments;
  }

  return attachments.filter((attachment) => {
    const allowedUsers = attachment.allowedUsers || [];

    if (normalizeUserId(attachment.createdBy) === normalizedUserId) {
      return true;
    }

    if (allowedUsers.length === 0) {
      return true;
    }

    const userIdAsNumber = Number.parseInt(normalizedUserId, 10);

    if (Number.isNaN(userIdAsNumber)) {
      return false;
    }

    return allowedUsers.includes(userIdAsNumber);
  });
}
