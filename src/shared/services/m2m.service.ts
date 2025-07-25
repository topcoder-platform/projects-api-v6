import { Injectable } from "@nestjs/common";
import * as m2m from 'tc-core-library-js/lib/auth/m2m';
import { Auth0Config } from '../../../config/config';

/**
 * M2M service to get M2M token.
 */
@Injectable()
export class M2MService {
  /**
   * Get M2M token
   * @returns m2m token
   */
  async getM2mToken(): Promise<string> {
    const m2mAuth = m2m({
      AUTH0_URL: Auth0Config.url,
      AUTH0_AUDIENCE: Auth0Config.audience,
      AUTH0_PROXY_SERVER_URL: Auth0Config.proxyServerUrl,
    });
    return m2mAuth.getMachineToken(Auth0Config.clientId, Auth0Config.clientSecret);
  }
}
