/**
 * Normalizer function for individual scope strings.
 */
type ScopeNormalizer = (scope: string) => string;

type ScopePayload = {
  scope?: unknown;
  scopes?: unknown;
  scp?: unknown;
  permissions?: unknown;
};

/**
 * Extracts scope-like claims from a payload and normalizes values.
 *
 * Supports `scope`, `scopes`, `scp`, and `permissions`. String claims are
 * split on arbitrary whitespace so copied token payloads that contain tabs or
 * newlines are handled the same as space-delimited scope strings.
 */
export function extractScopesFromPayload(
  payload: ScopePayload,
  normalizeScope: ScopeNormalizer = (scope) => scope.trim(),
): string[] {
  const extractedScopes: string[] = [];

  for (const rawScope of [
    payload.scope,
    payload.scopes,
    payload.scp,
    payload.permissions,
  ]) {
    if (typeof rawScope === 'string') {
      extractedScopes.push(
        ...rawScope
          .split(/\s+/u)
          .map((scope) => normalizeScope(scope))
          .filter((scope) => scope.length > 0),
      );
      continue;
    }

    if (Array.isArray(rawScope)) {
      extractedScopes.push(
        ...rawScope
          .map((scope) => normalizeScope(String(scope)))
          .filter((scope) => scope.length > 0),
      );
    }
  }

  return Array.from(new Set(extractedScopes));
}
