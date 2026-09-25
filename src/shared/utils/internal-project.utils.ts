import { ADMIN_ROLES, UserRole } from '../enums/userRole.enum';
import { JwtUser } from '../modules/global/jwt.service';

/**
 * Identifies human Talent Managers subject to internal-project restrictions.
 * Used by project queries and the global project-context interceptor.
 * @param user Authenticated caller; administrators and machine tokens retain their policies.
 * @returns Whether the caller must be excluded from internal projects.
 * @throws Does not throw.
 */
export function isRestrictedTalentManager(user?: JwtUser): boolean {
  if (!user || user.isMachine) return false;
  const roles = (user.roles || []).map((role) => role.trim().toLowerCase());
  return (
    !ADMIN_ROLES.some((role) => roles.includes(role.toLowerCase())) &&
    [UserRole.TALENT_MANAGER, UserRole.TOPCODER_TALENT_MANAGER].some((role) =>
      roles.includes(role.toLowerCase()),
    )
  );
}

/**
 * Reads the configured internal billing account IDs for list and direct access checks.
 * @param value Comma-separated positive IDs, defaulting to INTERNAL_BILLING_ACCOUNT_IDS.
 * @returns Deduplicated bigint IDs; an empty configuration has no internal accounts.
 * @throws Error if a configured ID is invalid, preventing a partial exclusion list.
 */
export function internalBillingAccountIds(
  value: string = process.env.INTERNAL_BILLING_ACCOUNT_IDS || '',
): bigint[] {
  if (!value.trim()) return [];
  const ids = value.split(',').map((entry) => {
    const id = entry.trim();
    if (!/^\d+$/.test(id) || BigInt(id) <= 0n) {
      throw new Error(
        'INTERNAL_BILLING_ACCOUNT_IDS must contain positive numeric IDs',
      );
    }
    return BigInt(id);
  });
  return [...new Set(ids)];
}
