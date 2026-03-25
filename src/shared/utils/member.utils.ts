/**
 * Member/invite enrichment and role-validation helpers.
 *
 * Used by project member and project invite services.
 */
import { InviteStatus, ProjectMemberRole } from '@prisma/client';
import { DEFAULT_PROJECT_ROLE } from 'src/shared/constants/permissions.constants';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { JwtUser } from 'src/shared/modules/global/jwt.service';

/**
 * Minimal user profile payload used for member/invite enrichment.
 */
export type MemberDetail = {
  userId?: string | number | bigint | null;
  handle?: string | null;
  handleLower?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/**
 * Project member shape accepted by enrichment helpers.
 */
export type ProjectMemberLike = {
  id?: string | number | bigint;
  userId?: string | number | bigint;
  role?: string | null;
  isPrimary?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Project invite shape accepted by enrichment helpers.
 */
export type ProjectInviteLike = {
  id?: string | number | bigint;
  userId?: string | number | bigint | null;
  email?: string | null;
  role?: string;
  status?: InviteStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Manager-tier Topcoder roles allowed to hold management project roles.
 *
 * This intentionally overlaps with, but is not identical to,
 * `MANAGER_ROLES` from `userRole.enum.ts`: Talent Manager roles may hold
 * management project memberships without broadening unrelated global
 * manager-only route access.
 */
const MANAGER_TOPCODER_ROLES: string[] = [
  UserRole.TOPCODER_ADMIN,
  UserRole.CONNECT_ADMIN,
  UserRole.MANAGER,
  UserRole.TOPCODER_ACCOUNT_MANAGER,
  UserRole.BUSINESS_DEVELOPMENT_REPRESENTATIVE,
  UserRole.PRESALES,
  UserRole.ACCOUNT_EXECUTIVE,
  UserRole.PROGRAM_MANAGER,
  UserRole.SOLUTION_ARCHITECT,
  UserRole.PROJECT_MANAGER,
  UserRole.TALENT_MANAGER,
  UserRole.TOPCODER_TALENT_MANAGER,
  UserRole.COPILOT_MANAGER,
];

/**
 * Mapping between project roles and allowed Topcoder roles.
 *
 * @todo Duplicates matrix data from `permissions.constants.ts`. Consolidate to
 * a single source of truth.
 */
const PROJECT_TO_TOPCODER_ROLES_MATRIX: Record<string, string[] | null> = {
  [ProjectMemberRole.customer]: null,
  [ProjectMemberRole.observer]: null,
  [ProjectMemberRole.manager]: MANAGER_TOPCODER_ROLES,
  [ProjectMemberRole.account_manager]: MANAGER_TOPCODER_ROLES,
  [ProjectMemberRole.account_executive]: MANAGER_TOPCODER_ROLES,
  [ProjectMemberRole.program_manager]: MANAGER_TOPCODER_ROLES,
  [ProjectMemberRole.solution_architect]: MANAGER_TOPCODER_ROLES,
  [ProjectMemberRole.project_manager]: MANAGER_TOPCODER_ROLES,
  [ProjectMemberRole.copilot]: [UserRole.COPILOT, UserRole.TC_COPILOT],
};

/**
 * Normalizes role strings for case-insensitive comparisons.
 *
 * @todo Duplicated in `permission.service.ts`; extract shared utility.
 */
function normalizeRole(value: string): string {
  return String(value).trim().toLowerCase();
}

/**
 * Normalizes user ids to trimmed strings.
 *
 * @todo Duplicated in `permission.service.ts`; extract shared utility.
 */
function normalizeUserId(
  value: string | number | bigint | null | undefined,
): string {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return String(value).trim();
}

/**
 * Normalizes emails for case-insensitive comparison.
 */
function normalizeEmail(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * Parses requested fields from CSV string or string array input.
 */
function parseFields(fields?: string[] | string): string[] {
  if (!fields) {
    return [];
  }

  if (Array.isArray(fields)) {
    return fields
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  }

  return String(fields)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Builds `Map<userId, detail>` for O(1) enrichment lookup.
 */
function buildDetailsMap(details: MemberDetail[]): Map<string, MemberDetail> {
  const map = new Map<string, MemberDetail>();

  for (const detail of details) {
    const userId = normalizeUserId(detail.userId);
    if (!userId) {
      continue;
    }

    map.set(userId, detail);
  }

  return map;
}

/**
 * Derives the default project role for a user.
 *
 * Evaluates `DEFAULT_PROJECT_ROLE` in order; first matching Topcoder role wins.
 *
 * @todo Duplicated in `permission.service.ts`; consolidate shared role
 * resolution logic.
 */
export function getDefaultProjectRole(
  user: JwtUser,
): ProjectMemberRole | undefined {
  for (const rule of DEFAULT_PROJECT_ROLE) {
    const normalizedUserRoles = (user.roles || []).map((role) =>
      normalizeRole(role),
    );
    const normalizedRuleRole = normalizeRole(rule.topcoderRole);

    if (normalizedUserRoles.includes(normalizedRuleRole)) {
      return rule.projectRole as ProjectMemberRole;
    }
  }

  return undefined;
}

/**
 * Validates that user Topcoder roles permit the requested project role.
 *
 * `customer` and `observer` are unrestricted by design. Full-access
 * `manager` membership accepts the same manager-tier Topcoder roles used for
 * project creation, including Talent Manager variants.
 */
export function validateUserHasProjectRole(
  role: ProjectMemberRole,
  topcoderRoles: string[] = [],
): boolean {
  const allowedTopcoderRoles = PROJECT_TO_TOPCODER_ROLES_MATRIX[role];

  if (!allowedTopcoderRoles || allowedTopcoderRoles.length === 0) {
    return true;
  }

  const normalizedRoles = topcoderRoles.map((entry) => normalizeRole(entry));

  return allowedTopcoderRoles.some((allowedRole) =>
    normalizedRoles.includes(normalizeRole(allowedRole)),
  );
}

/**
 * Enriches project members with user profile fields.
 *
 * Supported fields: `handle`, `email`, `firstName`, `lastName`.
 *
 * @todo Shares near-identical logic with `enrichInvitesWithUserDetails`.
 * Extract `enrichWithUserDetails<T>(items, getKey, fields, userDetails)`.
 */
export function enrichMembersWithUserDetails<T extends ProjectMemberLike>(
  members: T[],
  fields?: string[] | string,
  userDetails: MemberDetail[] = [],
): Array<T & Partial<MemberDetail>> {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }

  const requestedFields = new Set(
    parseFields(fields).map((field) => normalizeRole(field)),
  );
  const includeHandle = requestedFields.has('handle');
  const includeEmail = requestedFields.has('email');
  const includeFirstName = requestedFields.has('firstname');
  const includeLastName = requestedFields.has('lastname');

  if (
    !includeHandle &&
    !includeEmail &&
    !includeFirstName &&
    !includeLastName
  ) {
    return members as Array<T & Partial<MemberDetail>>;
  }

  const detailsByUserId = buildDetailsMap(userDetails);

  return members.map((member) => {
    const userId = normalizeUserId(member.userId);
    const detail = detailsByUserId.get(userId);

    return {
      ...member,
      ...(includeHandle ? { handle: detail?.handle ?? null } : {}),
      ...(includeEmail ? { email: detail?.email ?? null } : {}),
      ...(includeFirstName ? { firstName: detail?.firstName ?? null } : {}),
      ...(includeLastName ? { lastName: detail?.lastName ?? null } : {}),
    };
  }) as Array<T & Partial<MemberDetail>>;
}

/**
 * Enriches project invites with user profile fields.
 *
 * Supported fields: `handle`, `email`, `firstName`, `lastName`.
 * For `email`, falls back to `invite.email` when user detail is absent.
 *
 * @todo Shares near-identical logic with `enrichMembersWithUserDetails`.
 * Extract `enrichWithUserDetails<T>(items, getKey, fields, userDetails)`.
 */
export function enrichInvitesWithUserDetails<T extends ProjectInviteLike>(
  invites: T[],
  fields?: string[] | string,
  userDetails: MemberDetail[] = [],
): Array<T & Partial<MemberDetail>> {
  if (!Array.isArray(invites) || invites.length === 0) {
    return [];
  }

  const requestedFields = new Set(
    parseFields(fields).map((field) => normalizeRole(field)),
  );
  const includeHandle = requestedFields.has('handle');
  const includeEmail = requestedFields.has('email');
  const includeFirstName = requestedFields.has('firstname');
  const includeLastName = requestedFields.has('lastname');

  if (
    !includeHandle &&
    !includeEmail &&
    !includeFirstName &&
    !includeLastName
  ) {
    return invites as Array<T & Partial<MemberDetail>>;
  }

  const detailsByUserId = buildDetailsMap(userDetails);

  return invites.map((invite) => {
    const detail = detailsByUserId.get(normalizeUserId(invite.userId));

    return {
      ...invite,
      ...(includeHandle ? { handle: detail?.handle ?? null } : {}),
      ...(includeEmail ? { email: detail?.email ?? invite.email ?? null } : {}),
      ...(includeFirstName ? { firstName: detail?.firstName ?? null } : {}),
      ...(includeLastName ? { lastName: detail?.lastName ?? null } : {}),
    };
  }) as Array<T & Partial<MemberDetail>>;
}

/**
 * Compares two emails case-insensitively.
 *
 * When `UNIQUE_GMAIL_VALIDATION` is enabled, Gmail addresses are normalized for
 * dot-insensitivity and `@googlemail.com` alias compatibility.
 */
export function compareEmail(
  email1: string | null | undefined,
  email2: string | null | undefined,
  options: {
    UNIQUE_GMAIL_VALIDATION?: boolean;
  } = {},
): boolean {
  const normalizedEmail1 = normalizeEmail(email1);
  const normalizedEmail2 = normalizeEmail(email2);

  if (!normalizedEmail1 || !normalizedEmail2) {
    return false;
  }

  if (options.UNIQUE_GMAIL_VALIDATION) {
    const gmailPattern = /(^[\w.+-]+)(@gmail\.com|@googlemail\.com)$/;
    const match = gmailPattern.exec(normalizedEmail1);

    if (match) {
      const address = match[1].replace(/\./g, '');
      const domain = match[2].replace('.', '\\.');
      const regexAddress = address.split('').join('\\.?');
      const regex = new RegExp(`${regexAddress}${domain}`);

      return regex.test(normalizedEmail2);
    }
  }

  return normalizedEmail1 === normalizedEmail2;
}
