import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  Scope,
  SCOPE_HIERARCHY,
  SCOPE_SYNONYMS,
} from 'src/shared/enums/scopes.enum';
import { LoggerService } from './logger.service';

// tc-core-library-js is CommonJS-only.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tcCore = require('tc-core-library-js');

type TokenPayload = Record<string, unknown>;

@Injectable()
export class M2MService {
  private readonly logger = LoggerService.forRoot('M2MService');
  private readonly m2mClient: any;

  constructor() {
    if (tcCore?.auth?.m2m) {
      this.m2mClient = tcCore.auth.m2m({
        AUTH0_URL: process.env.AUTH0_URL,
        AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
        AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
      });
    }
  }

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

  extractScopes(payload: TokenPayload): string[] {
    const rawScopes = payload.scope || payload.scopes;

    if (typeof rawScopes === 'string') {
      return rawScopes
        .split(' ')
        .map((scope) => this.normalizeScope(scope))
        .filter((scope) => scope.length > 0);
    }

    if (Array.isArray(rawScopes)) {
      return rawScopes
        .map((scope) => this.normalizeScope(String(scope)))
        .filter((scope) => scope.length > 0);
    }

    return [];
  }

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

  private normalizeScope(scope: string): string {
    const normalizedScope = String(scope).trim().toLowerCase();

    if (normalizedScope === 'all:project') {
      return Scope.CONNECT_PROJECT_ADMIN;
    }

    return normalizedScope;
  }
}
