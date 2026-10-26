import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { createJwtVerifier, type JwtVerifier } from 'tc-core-library-js';

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
  tokenPayload?: Record<string, unknown>;
}

/** Adapts the shared verifier to project route identities; no alternate validation path is used. */
@Injectable()
export class JwtService implements OnModuleInit {
  private verifier?: JwtVerifier;

  /** Initializes trusted issuer settings; takes no arguments, returns void, and throws for invalid configuration. */
  onModuleInit(): void {
    this.verifier = createJwtVerifier({
      VALID_ISSUERS: process.env.VALID_ISSUERS,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
      JWT_AUDIENCE: process.env.JWT_AUDIENCE,
    });
  }

  /** Verifies a raw JWT or Bearer value and returns the route identity; throws UnauthorizedException on failure. */
  async validateToken(rawToken: string): Promise<JwtUser> {
    try {
      if (!this.verifier) throw new Error('JWT verifier is not initialized');
      const payload = await this.verifier.verify(
        rawToken.replace(/^Bearer /i, ''),
      );
      const id = payload.userId ?? payload.sub;
      return {
        userId: id === undefined ? undefined : String(id),
        handle: payload.handle,
        email: payload.email?.trim().toLowerCase(),
        roles: payload.roles,
        scopes: payload.scopes,
        isMachine: payload.isMachine,
        tokenPayload: payload,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
