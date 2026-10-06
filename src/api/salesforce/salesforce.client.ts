import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { SALESFORCE_CONFIG } from 'src/shared/config/salesforce.config';
import { LoggerService } from 'src/shared/modules/global/logger.service';

/**
 * Salesforce OAuth session kept in server memory only.
 */
interface SalesforceSession {
  accessToken: string;
  instanceUrl: string;
}

/**
 * Server-only Salesforce REST client using the OAuth client-credentials flow.
 *
 * Mirrors the Reports API Salesforce client: it reads records through SOQL and
 * never creates, updates or deletes anything. Access tokens stay in memory,
 * are shared between concurrent callers and are renewed once on a 401.
 */
@Injectable()
export class SalesforceClient {
  private readonly logger = LoggerService.forRoot('SalesforceClient');
  private session?: SalesforceSession;
  private authenticating?: Promise<SalesforceSession>;

  /**
   * Reports whether the client-credentials configuration is complete.
   *
   * @returns `true` when both the consumer key and secret are present
   */
  isConfigured(): boolean {
    return Boolean(
      SALESFORCE_CONFIG.consumerKey && SALESFORCE_CONFIG.consumerSecret,
    );
  }

  /**
   * Validates a configured or OAuth-provided Salesforce origin before
   * credentials or tokens are sent to it.
   *
   * @param origin HTTPS Salesforce origin without a path, credentials, query or custom port
   * @returns the normalized trusted origin
   * @throws ServiceUnavailableException when the origin is missing or untrusted
   */
  private salesforceOrigin(origin: string): string {
    try {
      const url = new URL(origin);
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.port &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash &&
        (url.hostname.endsWith('.my.salesforce.com') ||
          ['login.salesforce.com', 'test.salesforce.com'].includes(
            url.hostname,
          ))
      ) {
        return url.origin;
      }
    } catch {
      /* Invalid URLs report the same sanitized configuration error. */
    }

    throw new ServiceUnavailableException(
      'Salesforce integration is not configured.',
    );
  }

  /**
   * Returns the trusted Salesforce origin records are linked from.
   *
   * @returns the instance origin of the active session, or the configured login origin
   */
  instanceOrigin(): string {
    return (
      this.session?.instanceUrl ??
      this.salesforceOrigin(SALESFORCE_CONFIG.loginUrl)
    );
  }

  /**
   * Performs a bounded request, retrying network errors, throttling and 5xx.
   *
   * @param url trusted Salesforce API URL
   * @param init HTTP request options; bodies and credentials are never logged
   * @returns the first non-transient HTTP response
   * @throws BadGatewayException after three failed attempts
   */
  private async request(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let retryAfter = 0;
      try {
        const response = await fetch(url, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (response.status !== 429 && response.status < 500) {
          return response;
        }

        const header = response.headers.get('retry-after');
        retryAfter = header ? Number(header) * 1000 : 0;
        await response.body?.cancel();
        this.logger.warn(
          `Salesforce temporarily unavailable (HTTP ${response.status}).`,
        );
      } catch {
        this.logger.warn('Salesforce request timed out or failed to connect.');
      }

      if (attempt < 2) {
        await delay(
          Math.min(
            2000,
            Math.max(
              250 * 2 ** attempt,
              Number.isFinite(retryAfter) ? retryAfter : 0,
            ),
          ),
        );
      }
    }

    throw new BadGatewayException(
      'Salesforce is temporarily unavailable. Please try again.',
    );
  }

  /**
   * Obtains a client-credentials session, coalescing concurrent token requests.
   *
   * @returns a trusted instance URL and an access token kept only in memory
   * @throws ServiceUnavailableException when credentials are missing;
   * BadGatewayException when the OAuth exchange fails
   */
  private async authenticate(): Promise<SalesforceSession> {
    if (this.session) {
      return this.session;
    }

    if (this.authenticating) {
      return this.authenticating;
    }

    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Salesforce integration is not configured.',
      );
    }

    const origin = this.salesforceOrigin(SALESFORCE_CONFIG.loginUrl);

    this.authenticating = (async () => {
      const response = await this.request(`${origin}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: SALESFORCE_CONFIG.consumerKey,
          client_secret: SALESFORCE_CONFIG.consumerSecret,
        }),
      });

      if (!response.ok) {
        await response.body?.cancel();
        this.logger.warn(
          `Salesforce authentication rejected (HTTP ${response.status}).`,
        );
        throw new BadGatewayException(
          'Salesforce authentication failed. Contact your administrator.',
        );
      }

      let token: { access_token?: unknown; instance_url?: unknown };
      try {
        token = (await response.json()) as typeof token;
      } catch {
        throw new BadGatewayException(
          'Salesforce returned an invalid authentication response.',
        );
      }

      if (typeof token?.access_token !== 'string' || !token.access_token) {
        throw new BadGatewayException(
          'Salesforce returned an invalid authentication response.',
        );
      }

      this.session = {
        accessToken: token.access_token,
        instanceUrl: this.salesforceOrigin(
          typeof token.instance_url === 'string' ? token.instance_url : '',
        ),
      };

      return this.session;
    })();

    try {
      return await this.authenticating;
    } finally {
      this.authenticating = undefined;
    }
  }

  /**
   * Runs a read-only SOQL query, renewing an expired session once.
   *
   * Callers are responsible for building a safe query: values interpolated
   * into `soql` must already be validated against a strict allow-list format.
   *
   * @param soql SOQL statement to execute
   * @returns the `records` array returned by Salesforce
   * @throws ServiceUnavailableException for invalid configuration;
   * BadGatewayException for upstream or malformed responses
   */
  async query<TRecord = Record<string, unknown>>(
    soql: string,
  ): Promise<TRecord[]> {
    const version = SALESFORCE_CONFIG.apiVersion;
    if (!/^\d{2,3}\.0$/.test(version)) {
      throw new ServiceUnavailableException(
        'Salesforce API version is not configured correctly.',
      );
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const session = await this.authenticate();
      const url = `${session.instanceUrl}/services/data/v${version}/query?q=${encodeURIComponent(soql)}`;
      const response = await this.request(url, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/json',
        },
      });

      if (response.status === 401 && attempt === 0) {
        await response.body?.cancel();
        if (this.session === session) {
          this.session = undefined;
        }

        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        this.logger.warn(
          `Salesforce query rejected (HTTP ${response.status}).`,
        );
        throw new BadGatewayException(
          'Salesforce data could not be loaded. Please try again.',
        );
      }

      let payload: { records?: unknown };
      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        throw new BadGatewayException(
          'Salesforce returned an invalid response.',
        );
      }

      if (!Array.isArray(payload?.records)) {
        throw new BadGatewayException(
          'Salesforce returned an invalid response.',
        );
      }

      return payload.records as TRecord[];
    }

    throw new BadGatewayException(
      'Salesforce authentication failed. Contact your administrator.',
    );
  }
}
