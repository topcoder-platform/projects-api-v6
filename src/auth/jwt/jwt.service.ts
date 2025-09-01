import { JwtUser } from '../auth.dto';
import { AppConfig } from '../../../config/config';
import * as verifier from 'tc-core-library-js/lib/auth/verifier';
import { Verifier } from 'types/tc-core-library-js';
import { Logger } from '@nestjs/common';

const jwtCacheTime = '24h';

export class JwtService {
  private readonly logger = new Logger(JwtService.name);

  constructor() {}

  verify(token: string): Promise<JwtUser> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const authVerifier: Verifier = verifier(
      AppConfig.validIssuers,
      jwtCacheTime,
    );
    return new Promise((resolve, reject) => {
      authVerifier.validateToken(
        token,
        AppConfig.authSecret,
        (err, decoded) => {
          if (err) {
            this.logger.debug(`Error verifying jwt token.`, err);
            return reject(err);
          }
          // parse decoded to JwtUser
          // Copy code from https://github.com/appirio-tech/tc-core-library-js/blob/master/lib/middleware/jwtAuthenticator.js
          const authUser: JwtUser = { roles: [], scopes: [] };
          let gty: string | null = null;
          for (const key in decoded) {
            const value = decoded[key];
            if (key.includes('userId')) {
              authUser.userId = Number(value as string | number);
            }
            if (key.includes('handle')) {
              authUser.handle = value as string;
            }
            if (key.includes('roles')) {
              authUser.roles = value as string[];
            }
            if (!authUser.email && key.includes('email')) {
              authUser.email = value as string;
            }
            if (key.includes('scope')) {
              authUser.scopes = (value as string).split(' ');
            }
            if (key.includes('gty')) {
              gty = value as string;
            }
          }
          if (
            gty === 'client-credentials' &&
            !authUser.userId &&
            authUser.roles.length === 0
          ) {
            authUser.isMachine = true;
          }
          this.logger.debug(`Decoded user: ${JSON.stringify(authUser)}`);
          resolve(authUser);
        },
      );
    });
  }
}
