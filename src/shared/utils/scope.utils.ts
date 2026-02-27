/**
 * Normalizer function for individual scope strings.
 */
type ScopeNormalizer = (scope: string) => string;

type ScopePayload = {
  scope?: unknown;
  scopes?: unknown;
};

/**
 * Extracts `scope` / `scopes` claims from a payload and normalizes values.
 */
export function extractScopesFromPayload(
  payload: ScopePayload,
  normalizeScope: ScopeNormalizer = (scope) => scope.trim(),
): string[] {
  const rawScopes = payload.scope || payload.scopes;

  if (typeof rawScopes === 'string') {
    return rawScopes
      .split(' ')
      .map((scope) => normalizeScope(scope))
      .filter((scope) => scope.length > 0);
  }

  if (Array.isArray(rawScopes)) {
    return rawScopes
      .map((scope) => normalizeScope(String(scope)))
      .filter((scope) => scope.length > 0);
  }

  return [];
}
