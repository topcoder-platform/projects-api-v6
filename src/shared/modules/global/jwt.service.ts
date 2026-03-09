import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { extractScopesFromPayload } from 'src/shared/utils/scope.utils';
import { LoggerService } from './logger.service';

/**
 * JWT validation service.
 *
 * Implements a dual-path token validation strategy:
 * 1) legacy tc-core middleware validation, then
 * 2) JWKS-backed Auth0/JWT validation fallback.
 *
 * Runtime behavior is environment-dependent and includes non-production
 * shortcuts that should not be used in internet-accessible environments.
 */
// tc-core-library-js is CommonJS-only.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tcCore = require('tc-core-library-js');

type JwtPayloadRecord = Record<string, unknown>;

/**
 * Authenticated user model derived from JWT payload data.
 */
export interface JwtUser {
  /**
   * Primary user identifier when present.
   *
   * Expected to be a numeric string parseable by `BigInt` (for example from
   * `userId`/`sub` claims). Extraction prefers numeric identifiers and falls
   * back to other identifier claims when necessary.
   */
  userId?: string;
  /**
   * User email extracted from token claims.
   */
  email?: string;
  /**
   * Topcoder handle extracted from token claims.
   */
  handle?: string;
  /**
   * Role names extracted from token claims.
   */
  roles?: string[];
  /**
   * Token scopes in normalized list form.
   */
  scopes?: string[];
  /**
   * Indicates whether the token appears to be a machine-to-machine token.
   */
  isMachine: boolean;
  /**
   * Raw token payload used for downstream claim access.
   */
  tokenPayload?: JwtPayloadRecord;
}

@Injectable()
/**
 * Service that validates and parses JWT tokens into a normalized `JwtUser`.
 */
export class JwtService implements OnModuleInit {
  private readonly logger = LoggerService.forRoot('JwtService');
  private readonly jwksClients = new Map<string, jwksClient.JwksClient>();
  private readonly validIssuers = this.getValidIssuers();
  private readonly audience = process.env.AUTH0_AUDIENCE;
  private jwtAuthenticator: any;

  /**
   * Initializes the optional tc-core JWT authenticator.
   *
   * If `AUTH_SECRET` is absent, tc-core validation is skipped and only the JWKS
   * fallback path can validate tokens.
   */
  onModuleInit(): void {
    if (tcCore?.middleware?.jwtAuthenticator) {
      if (!process.env.AUTH_SECRET) {
        // TODO (security): Absence of AUTH_SECRET only logs a warning and disables tc-core validation. The service continues to start. Ensure the JWKS fallback path is always configured in production when AUTH_SECRET is omitted.
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

  /**
   * Validates an incoming JWT and builds a normalized user model.
   *
   * Accepts either a raw JWT string or a `Bearer ` prefixed token.
   *
   * @param {string} rawToken Raw token or Bearer token value.
   * @returns {Promise<JwtUser>} Parsed authenticated user data.
   * @throws {UnauthorizedException} When token validation fails.
   */
  async validateToken(rawToken: string): Promise<JwtUser> {
    const token = this.normalizeToken(rawToken);

    let payload = await this.validateWithTcCore(token);
    if (!payload) {
      payload = await this.validateWithJwt(token);
    }

    return this.buildJwtUser(payload);
  }

  /**
   * Normalizes a raw Authorization header/token value.
   *
   * Removes a leading `Bearer ` prefix and trims whitespace.
   *
   * @param {string} token Raw token value.
   * @returns {string} Normalized token string.
   * @throws {UnauthorizedException} When token is empty after normalization.
   */
  private normalizeToken(token: string): string {
    const normalized = token.startsWith('Bearer ')
      ? token.slice('Bearer '.length)
      : token;

    if (!normalized || normalized.trim().length === 0) {
      throw new UnauthorizedException('Invalid token');
    }

    return normalized.trim();
  }

  /**
   * Validates a token using tc-core's Express-style middleware wrapper.
   *
   * @param {string} token Normalized token.
   * @returns {Promise<JwtPayloadRecord | null>} Decoded payload or null when tc-core validation is unavailable.
   * @throws {UnauthorizedException} In production when tc-core validation fails.
   */
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

      // TODO (security): In non-production, a tc-core validation failure is swallowed and returns null, causing fallthrough to validateWithJwt which skips signature verification. This means any structurally valid JWT is accepted in non-production. Ensure non-production environments are never internet-accessible.
      this.logger.warn(
        `tc-core token validation fallback used: ${error instanceof Error ? error.message : String(error)}`,
      );

      return null;
    }
  }

  /**
   * Validates a token using JWT parsing and, in production, JWKS signature checks.
   *
   * @param {string} token Normalized token.
   * @returns {Promise<JwtPayloadRecord>} Verified JWT payload.
   * @throws {UnauthorizedException} When token structure is invalid, issuer/keyId is missing, signing key cannot be fetched, or signature verification fails.
   */
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
      // TODO (security): CRITICAL - JWT signature verification is skipped entirely in non-production (NODE_ENV !== 'production'). Any token with a valid structure will be accepted. This must never reach a publicly accessible environment.
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

  /**
   * Resolves the JWT signing key from issuer JWKS data.
   *
   * Lazily initializes and caches one JWKS client per issuer.
   *
   * @param {string} issuer Token issuer URL.
   * @param {string} keyId JWT key identifier (`kid`).
   * @returns {Promise<jwt.Secret>} Public key used for signature verification.
   * @throws {UnauthorizedException} When the JWKS client cannot be initialized or key lookup fails.
   */
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

  /**
   * Builds a normalized `JwtUser` model from token payload claims.
   *
   * Uses a two-pass extraction strategy:
   * 1) direct known-claim extraction for standard fields
   * 2) suffix-based fallback scanning for alternate claim names
   *
   * @param {JwtPayloadRecord} payload Decoded JWT payload.
   * @returns {JwtUser} Parsed user and machine-token metadata.
   */
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

    const userId = this.extractUserId(payload);
    if (userId) {
      user.userId = userId;
    }
    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();

      if (lowerKey.endsWith('userid')) {
        const value = this.extractIdentifier(payload[key]);
        if (
          value &&
          (!user.userId ||
            (!this.isNumericIdentifier(user.userId) &&
              this.isNumericIdentifier(value)))
        ) {
          user.userId = value;
        }
      }

      if (!user.handle && lowerKey.endsWith('handle')) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          user.handle = value;
        }
      }

      if (!user.email && lowerKey.endsWith('email')) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          user.email = value.trim().toLowerCase();
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

    if (
      (!user.userId || !this.isNumericIdentifier(user.userId)) &&
      user.handle &&
      this.isNumericIdentifier(user.handle)
    ) {
      user.userId = user.handle;
    }

    return user;
  }

  /**
   * Extracts token scopes from supported scope-like claims.
   *
   * @param {JwtPayloadRecord} payload Token payload.
   * @returns {string[]} Normalized list of scopes.
   */
  private extractScopes(payload: JwtPayloadRecord): string[] {
    return extractScopesFromPayload(payload, (scope) => scope.trim());
  }

  /**
   * Extracts a user identifier from common claims.
   *
   * @param {JwtPayloadRecord} payload Token payload.
   * @returns {string | undefined} User identifier from `userId`/`sub`/`handle`.
   * Numeric values are preferred so downstream `BigInt` parsing can succeed.
   */
  private extractUserId(payload: JwtPayloadRecord): string | undefined {
    const candidates = [
      this.extractIdentifier(payload.userId),
      this.extractIdentifier(payload.sub),
      this.extractIdentifier(payload.handle),
    ].filter((value): value is string => typeof value === 'string');

    const numericCandidate = candidates.find((value) =>
      this.isNumericIdentifier(value),
    );
    if (numericCandidate) {
      return numericCandidate;
    }

    return candidates[0];
  }

  /**
   * Converts supported identifier types into string form.
   *
   * @param {unknown} value Candidate identifier value.
   * @returns {string | undefined} Normalized identifier string.
   */
  private extractIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      return String(value);
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    return undefined;
  }

  /**
   * Checks whether an identifier string is purely numeric.
   *
   * @param {string} value Identifier value.
   * @returns {boolean} True when the value contains only digits.
   */
  private isNumericIdentifier(value: string): boolean {
    return /^\d+$/.test(value.trim());
  }

  /**
   * Reads valid JWT issuers from `VALID_ISSUERS`.
   *
   * Supports JSON array or comma-separated string formats.
   *
   * @returns {string[]} Configured issuer values.
   */
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

  /**
   * Resolves issuer value from token payload or configuration fallback.
   *
   * @param {JwtPayloadRecord} payload Token payload.
   * @returns {string | undefined} Resolved issuer.
   */
  private resolveIssuer(payload: JwtPayloadRecord): string | undefined {
    const issuer = payload.iss;

    if (typeof issuer === 'string' && issuer.trim().length > 0) {
      return issuer;
    }

    // TODO (security): When the token has no 'iss' claim, this method falls back to validIssuers[0]. A token without an issuer claim should be rejected outright rather than assumed to belong to the first configured issuer.
    if (this.validIssuers.length > 0) {
      return this.validIssuers[0];
    }

    return undefined;
  }

  /**
   * Extracts an error message from tc-core middleware response payloads.
   *
   * @param {unknown} payload Error payload.
   * @returns {string | undefined} Extracted message text.
   */
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
