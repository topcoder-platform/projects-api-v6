import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { LoggerService } from './logger.service';

// tc-core-library-js is CommonJS-only.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tcCore = require('tc-core-library-js');

type JwtPayloadRecord = Record<string, unknown>;

export interface JwtUser {
  userId?: string;
  handle?: string;
  roles?: string[];
  scopes?: string[];
  isMachine: boolean;
  tokenPayload?: JwtPayloadRecord;
}

@Injectable()
export class JwtService implements OnModuleInit {
  private readonly logger = LoggerService.forRoot('JwtService');
  private readonly jwksClients = new Map<string, jwksClient.JwksClient>();
  private readonly validIssuers = this.getValidIssuers();
  private readonly audience = process.env.AUTH0_AUDIENCE;
  private jwtAuthenticator: any;

  onModuleInit(): void {
    if (tcCore?.middleware?.jwtAuthenticator) {
      if (!process.env.AUTH_SECRET) {
        this.logger.warn(
          'AUTH_SECRET is not configured. tc-core JWT validator disabled.',
        );
        return;
      }

      try {
        this.jwtAuthenticator = tcCore.middleware.jwtAuthenticator({
          AUTH_SECRET: process.env.AUTH_SECRET,
          VALID_ISSUERS: JSON.stringify(this.validIssuers),
        });
      } catch (error) {
        this.logger.warn(
          `Failed to initialize tc-core JWT validator: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  async validateToken(rawToken: string): Promise<JwtUser> {
    const token = this.normalizeToken(rawToken);

    let payload = await this.validateWithTcCore(token);
    if (!payload) {
      payload = await this.validateWithJwt(token);
    }

    return this.buildJwtUser(payload);
  }

  private normalizeToken(token: string): string {
    const normalized = token.startsWith('Bearer ')
      ? token.slice('Bearer '.length)
      : token;

    if (!normalized || normalized.trim().length === 0) {
      throw new UnauthorizedException('Invalid token');
    }

    return normalized.trim();
  }

  private async validateWithTcCore(
    token: string,
  ): Promise<JwtPayloadRecord | null> {
    if (!this.jwtAuthenticator) {
      return null;
    }

    try {
      return await new Promise<JwtPayloadRecord | null>((resolve, reject) => {
        const request: Record<string, any> = {
          headers: {
            authorization: `Bearer ${token}`,
          },
        };

        const rejectUnauthorized = (payload?: unknown) => {
          const message = this.extractErrorMessage(payload);
          reject(new UnauthorizedException(message || 'Invalid token'));
        };

        const response = {
          status: () => ({
            json: (payload?: unknown) => rejectUnauthorized(payload),
          }),
          json: (payload?: unknown) => rejectUnauthorized(payload),
          send: (payload?: unknown) => rejectUnauthorized(payload),
        };

        const next = (error?: unknown) => {
          if (error) {
            reject(new UnauthorizedException('Invalid token'));
            return;
          }

          const authUser = request.authUser;
          if (!authUser || typeof authUser !== 'object') {
            resolve(null);
            return;
          }

          resolve(authUser as JwtPayloadRecord);
        };

        this.jwtAuthenticator(request, response, next);
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Invalid token');
      }

      this.logger.warn(
        `tc-core token validation fallback used: ${error instanceof Error ? error.message : String(error)}`,
      );

      return null;
    }
  }

  private async validateWithJwt(token: string): Promise<JwtPayloadRecord> {
    const decoded = jwt.decode(token, { complete: true }) as
      | (jwt.Jwt & { payload?: jwt.JwtPayload | string })
      | null;

    if (!decoded || typeof decoded !== 'object') {
      throw new UnauthorizedException('Invalid token');
    }

    if (!decoded.payload || typeof decoded.payload === 'string') {
      throw new UnauthorizedException('Invalid token');
    }

    const payload = decoded.payload as JwtPayloadRecord;

    if (process.env.NODE_ENV !== 'production') {
      return payload;
    }

    const issuer = this.resolveIssuer(payload);
    const keyId =
      decoded.header && typeof decoded.header.kid === 'string'
        ? decoded.header.kid
        : undefined;

    if (!issuer || !keyId) {
      throw new UnauthorizedException('Invalid token');
    }

    const signingKey = await this.getSigningKey(issuer, keyId);
    const verifyIssuer =
      this.validIssuers.length > 0
        ? (this.validIssuers as [string, ...string[]])
        : issuer;

    const verifiedPayload = jwt.verify(token, signingKey, {
      issuer: verifyIssuer,
      audience: this.audience,
    }) as jwt.JwtPayload;

    return verifiedPayload as JwtPayloadRecord;
  }

  private getSigningKey(issuer: string, keyId: string): Promise<jwt.Secret> {
    const normalizedIssuer = issuer.replace(/\/$/, '');

    if (!this.jwksClients.has(normalizedIssuer)) {
      this.jwksClients.set(
        normalizedIssuer,
        jwksClient({
          jwksUri: `${normalizedIssuer}/.well-known/jwks.json`,
          cache: true,
          rateLimit: true,
        }),
      );
    }

    const client = this.jwksClients.get(normalizedIssuer);
    if (!client) {
      throw new UnauthorizedException(
        'Unable to initialize signing key client',
      );
    }

    return new Promise((resolve, reject) => {
      client.getSigningKey(keyId, (error, key) => {
        if (error || !key) {
          reject(new UnauthorizedException('Invalid token signing key'));
          return;
        }

        const signingKey = key.getPublicKey();
        if (!signingKey) {
          reject(new UnauthorizedException('Invalid token signing key'));
          return;
        }

        resolve(signingKey);
      });
    });
  }

  private buildJwtUser(payload: JwtPayloadRecord): JwtUser {
    const user: JwtUser = {
      isMachine: false,
      tokenPayload: payload,
    };

    const extractedScopes = this.extractScopes(payload);
    if (extractedScopes.length > 0) {
      user.scopes = extractedScopes;
      user.isMachine = true;
    }

    const userId = this.extractString(payload, ['userId', 'sub']);
    if (userId) {
      user.userId = userId;
    }

    const handle = this.extractString(payload, ['handle']);
    if (handle) {
      user.handle = handle;
    }

    const roles = this.extractRoles(payload);
    if (roles.length > 0) {
      user.roles = roles;
    }

    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();

      if (!user.userId && lowerKey.endsWith('userid')) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          user.userId = value;
        }
      }

      if (!user.handle && lowerKey.endsWith('handle')) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          user.handle = value;
        }
      }

      if (
        (!user.roles || user.roles.length === 0) &&
        lowerKey.endsWith('roles')
      ) {
        const roleValue = payload[key];
        if (Array.isArray(roleValue)) {
          user.roles = roleValue
            .map((role) => String(role).trim())
            .filter((role) => role.length > 0);
        }
      }
    }

    return user;
  }

  private extractScopes(payload: JwtPayloadRecord): string[] {
    const rawScope = payload.scope || payload.scopes;

    if (typeof rawScope === 'string') {
      return rawScope
        .split(' ')
        .map((scope) => scope.trim())
        .filter((scope) => scope.length > 0);
    }

    if (Array.isArray(rawScope)) {
      return rawScope
        .map((scope) => String(scope).trim())
        .filter((scope) => scope.length > 0);
    }

    return [];
  }

  private extractRoles(payload: JwtPayloadRecord): string[] {
    const rawRoles = payload.roles;

    if (!Array.isArray(rawRoles)) {
      return [];
    }

    return rawRoles
      .map((role) => String(role).trim())
      .filter((role) => role.length > 0);
  }

  private extractString(
    payload: JwtPayloadRecord,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private getValidIssuers(): string[] {
    const validIssuers = process.env.VALID_ISSUERS;

    if (!validIssuers) {
      return [];
    }

    try {
      const parsed = JSON.parse(validIssuers) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((issuer) => String(issuer).trim())
          .filter((issuer) => issuer.length > 0);
      }
    } catch {
      return validIssuers
        .split(',')
        .map((issuer) => issuer.trim())
        .filter((issuer) => issuer.length > 0);
    }

    return [];
  }

  private resolveIssuer(payload: JwtPayloadRecord): string | undefined {
    const issuer = payload.iss;

    if (typeof issuer === 'string' && issuer.trim().length > 0) {
      return issuer;
    }

    if (this.validIssuers.length > 0) {
      return this.validIssuers[0];
    }

    return undefined;
  }

  private extractErrorMessage(payload: unknown): string | undefined {
    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const maybeMessage = (payload as Record<string, unknown>).message;
      if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
        return maybeMessage;
      }
    }

    return undefined;
  }
}
