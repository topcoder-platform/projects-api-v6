import { Injectable } from '@nestjs/common';
import * as core from 'tc-core-library-js';
import { M2MConfig } from '../../../config/config';

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
    const m2mConfig = M2MConfig();

    const m2mAuth = core.auth.m2m({
      AUTH0_URL: m2mConfig.url,
      AUTH0_AUDIENCE: m2mConfig.audience,
      AUTH0_PROXY_SERVER_URL: m2mConfig.proxyServerUrl,
    });

    return m2mAuth.getMachineToken(m2mConfig.clientId, m2mConfig.clientSecret);
  }
}
