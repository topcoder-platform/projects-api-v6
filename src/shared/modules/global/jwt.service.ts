import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { auth } from 'tc-core-library-js';

/** Domain adapter for the shared principal; member IDs remain strings and tokenPayload contains only normalized claims. */
export interface JwtUser {
  kind?: 'user' | 'service';
  clientId?: string;
  userId?: string;
  email?: string;
  handle?: string;
  roles?: string[];
  scopes?: string[];
  isMachine: boolean;
  tokenPayload?: Record<string, unknown>;
}

/** Validates every token through the shared core, with no decode-only or issuer fallback path. */
@Injectable()
export class JwtService implements OnModuleInit {
  private validator?: ReturnType<typeof auth.createValidator>;

  /** Initializes explicit Keycloak and member trust configuration; takes no arguments and throws on invalid settings. */
  onModuleInit(): void {
    this.validator = auth.createValidator();
  }

  /**
   * Verifies rawToken and adapts its member ID for domain code; used by the global guard.
   * @param rawToken Compact JWT or Bearer-prefixed header.
   * @returns Verified principal with authoritative kind/scopes and a string member ID.
   * @throws UnauthorizedException for invalid tokens or an unavailable validator.
   */
  async validateToken(rawToken: string): Promise<JwtUser> {
    try {
      if (!this.validator) throw new Error('Validator unavailable');
      const principal = await this.validator.verify(
        rawToken.replace(/^Bearer /, '').trim(),
      );
      return {
        ...principal,
        userId:
          principal.userId === undefined ? undefined : String(principal.userId),
        email: principal.email?.trim().toLowerCase(),
        tokenPayload: principal,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
