import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  Scope,
  SCOPE_HIERARCHY,
  SCOPE_SYNONYMS,
} from 'src/shared/enums/scopes.enum';
import { extractScopesFromPayload } from 'src/shared/utils/scope.utils';
import { LoggerService } from './logger.service';

/**
 * Machine-to-machine authentication helpers.
 *
 * Provides M2M token acquisition through tc-core/Auth0 and scope utilities
 * used to classify machine tokens and evaluate scope-based access.
 */
// tc-core-library-js is CommonJS-only.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tcCore = require('tc-core-library-js');

type TokenPayload = Record<string, unknown>;

@Injectable()
/**
 * Service for M2M token management and scope expansion.
 *
 * Scope expansion uses both `SCOPE_HIERARCHY` and `SCOPE_SYNONYMS` to compute
 * effective permissions.
 */
export class M2MService {
  private readonly logger = LoggerService.forRoot('M2MService');
  private readonly m2mClient: any;

  // TODO (security): AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are read at call-time in getM2MToken() rather than validated at startup. A missing secret will only surface at runtime when a token is first requested.
  // TODO (quality): m2mClient is typed as 'any'. Define an interface for the tc-core M2M client to enable type safety.
  /**
   * Creates the tc-core M2M client when tc-core auth bindings are available.
   */
  constructor() {
    if (tcCore?.auth?.m2m) {
      this.m2mClient = tcCore.auth.m2m({
        AUTH0_URL: process.env.AUTH0_URL,
        AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
        AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
      });
    }
  }

  /**
   * Fetches an M2M token from Auth0 through tc-core.
   *
   * @returns {Promise<string>} Machine token string.
   * @throws {InternalServerErrorException} When the client is not initialized, credentials are missing, or token retrieval fails.
   */
  async getM2MToken(): Promise<string> {
    if (!this.m2mClient) {
      throw new InternalServerErrorException('M2M client is not initialized.');
    }

    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'M2M credentials are not configured.',
      );
    }

    try {
      const token = await this.m2mClient.getMachineToken(
        clientId,
        clientSecret,
      );
      return String(token);
    } catch (error) {
      this.logger.error(
        `Failed to retrieve M2M token: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to retrieve M2M token.');
    }
  }

  /**
   * Determines whether a token payload represents a machine token.
   *
   * @param {TokenPayload} [payload] Optional decoded token payload.
   * @returns {{ isMachine: boolean; scopes: string[] }} Machine-token classification and extracted scopes.
   */
  validateMachineToken(payload?: TokenPayload): {
    isMachine: boolean;
    scopes: string[];
  } {
    if (!payload) {
      return {
        isMachine: false,
        scopes: [],
      };
    }

    const scopes = this.extractScopes(payload);
    const grantType = payload.gty;

    const isMachine =
      scopes.length > 0 ||
      (typeof grantType === 'string' &&
        grantType.toLowerCase() === 'client-credentials');

    return {
      isMachine,
      scopes,
    };
  }

  /**
   * Extracts scope-like claims from token payload.
   *
   * @param {TokenPayload} payload Decoded token payload.
   * @returns {string[]} Normalized scopes.
   */
  extractScopes(payload: TokenPayload): string[] {
    return extractScopesFromPayload(payload, (scope) =>
      this.normalizeScope(scope),
    );
  }

  /**
   * Expands scopes transitively using hierarchy and synonym relationships.
   *
   * Uses breadth-first traversal over scope graph edges derived from
   * `SCOPE_HIERARCHY` and canonical scope mappings in `SCOPE_SYNONYMS`.
   *
   * @param {string[]} scopes Input scopes.
   * @returns {string[]} All normalized and transitively implied scopes.
   */
  expandScopes(scopes: string[]): string[] {
    const expandedScopes = new Set<string>();
    const queue = scopes.map((scope) => this.normalizeScope(scope));

    while (queue.length > 0) {
      const scope = queue.shift();

      if (!scope) {
        continue;
      }

      const synonyms = SCOPE_SYNONYMS[scope] || [];
      const canonicalScope =
        synonyms.length > 0 ? this.normalizeScope(synonyms[0]) : scope;

      if (!expandedScopes.has(scope)) {
        expandedScopes.add(scope);
      }

      if (!expandedScopes.has(canonicalScope)) {
        expandedScopes.add(canonicalScope);
      }

      const relatedScopes = SCOPE_HIERARCHY[scope] || [];
      const canonicalRelatedScopes = SCOPE_HIERARCHY[canonicalScope] || [];

      for (const relatedScope of [
        ...relatedScopes,
        ...canonicalRelatedScopes,
      ]) {
        const normalizedRelatedScope = this.normalizeScope(relatedScope);
        if (!expandedScopes.has(normalizedRelatedScope)) {
          queue.push(normalizedRelatedScope);
        }
      }
    }

    return Array.from(expandedScopes);
  }

  /**
   * Checks whether token scopes satisfy any required scope after expansion.
   *
   * Uses OR semantics: returns true when any expanded required scope is present
   * in expanded token scopes.
   *
   * @param {string[]} tokenScopes Scopes from the token.
   * @param {string[]} requiredScopes Scopes required by an operation.
   * @returns {boolean} True when authorization requirements are satisfied.
   */
  hasRequiredScopes(tokenScopes: string[], requiredScopes: string[]): boolean {
    if (requiredScopes.length === 0) {
      return true;
    }

    const expandedTokenScopes = new Set(this.expandScopes(tokenScopes));
    const expandedRequiredScopes = this.expandScopes(requiredScopes);

    return expandedRequiredScopes.some((requiredScope) =>
      expandedTokenScopes.has(this.normalizeScope(requiredScope)),
    );
  }

  /**
   * Normalizes a scope string and applies legacy compatibility aliases.
   *
   * @param {string} scope Scope value to normalize.
   * @returns {string} Normalized scope.
   */
  private normalizeScope(scope: string): string {
    const normalizedScope = String(scope).trim().toLowerCase();

    // TODO (security): The hardcoded mapping of 'all:project' -> Scope.CONNECT_PROJECT_ADMIN is a legacy compatibility shim. Document the origin of this alias and audit whether it grants broader access than intended.
    if (normalizedScope === 'all:project') {
      return Scope.CONNECT_PROJECT_ADMIN;
    }

    return normalizedScope;
  }
}
