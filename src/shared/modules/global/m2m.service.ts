import { Injectable } from '@nestjs/common';
import { auth, Principal } from 'tc-core-library-js';
import { JwtUser } from './jwt.service';
import { SCOPE_HIERARCHY, SCOPE_SYNONYMS } from '../../enums/scopes.enum';

/**
 * Outbound M2M token issuance and explicit route-scope policy; never classifies raw JWT claims.
 *
 * Tokens come from the provider selected by `USE_KEYCLOAK`. With `true` the core uses
 * `KEYCLOAK_TOKEN_URL`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`
 * (and optional `KEYCLOAK_SCOPE`) and ignores the Auth0 options. Unset or `false` uses the
 * Auth0 settings from {@link M2MService.auth0Options} plus `AUTH0_CLIENT_ID` and
 * `AUTH0_CLIENT_SECRET`, as before the Keycloak migration. Injected into the member,
 * identity and billing-account services and into the guards.
 */
@Injectable()
export class M2MService {
  private readonly client = auth.m2m(M2MService.auth0Options());

  /**
   * Read the Auth0 token settings this service used before the Keycloak migration.
   * Takes no parameters; returns `AUTH0_URL`, `AUTH0_AUDIENCE` and `AUTH0_PROXY_SERVER_URL`
   * from the environment for `auth.m2m`, which uses them only when `USE_KEYCLOAK` is not true.
   * Does not throw.
   */
  static auth0Options(): Record<string, string | undefined> {
    return {
      AUTH0_URL: process.env.AUTH0_URL,
      AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
      AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
    };
  }

  /**
   * Return a cached or new token from the active provider for downstream calls.
   * Takes no arguments; the credentials default to `KEYCLOAK_CLIENT_ID`/`SECRET` when
   * `USE_KEYCLOAK=true` and to `AUTH0_CLIENT_ID`/`SECRET` otherwise.
   * @returns The bearer token (Keycloak tokens are verified before they are returned).
   * @throws Rejects when the active provider's credentials or endpoint are missing or issuance fails.
   */
  getM2MToken(): Promise<string> {
    return this.client.getMachineToken();
  }

  /**
   * Reads authoritative machine status from a normalized principal for guards/domain policy.
   * @param user Verified principal; raw token claim bags must not be passed here.
   * @returns Machine flag and exact scopes, or a non-machine empty scope set. Does not throw.
   */
  validateMachineToken(user?: JwtUser): {
    isMachine: boolean;
    scopes: string[];
  } {
    const isMachine = user?.kind === 'service' && user.isMachine === true;
    return {
      isMachine,
      scopes: isMachine && Array.isArray(user.scopes) ? user.scopes : [],
    };
  }

  /**
   * Checks exact any-of route scopes on a verified service principal.
   * @param user Principal attached by the common validator.
   * @param requiredScopes Required route/domain permissions; never expanded to weaker permissions.
   * @returns Access decision; empty policy/member tokens deny. Throws for malformed scope policies.
   */
  hasRequiredScopes(
    user: JwtUser | undefined,
    requiredScopes: string[],
  ): boolean {
    if (!requiredScopes.length || !user) return false;
    const policyPrincipal = {
      ...user,
      scopes: this.expandScopes(user.scopes || []),
    };
    return auth.hasScopes(
      policyPrincipal as unknown as Principal,
      requiredScopes,
      'any',
    );
  }

  /**
   * Applies the existing explicit hierarchy/aliases only to granted service scopes.
   * @param scopes Exact grants from the normalized principal; case is preserved.
   * @returns Unique grants plus their one-way implications; never changes the supplied array or throws.
   */
  expandScopes(scopes: string[]): string[] {
    const expanded = new Set<string>();
    const pending = [...scopes];
    while (pending.length) {
      const scope = pending.shift()!;
      if (expanded.has(scope)) continue;
      expanded.add(scope);
      pending.push(
        ...(SCOPE_HIERARCHY[scope] || []),
        ...(SCOPE_SYNONYMS[scope] || []),
      );
    }
    return [...expanded];
  }
}
