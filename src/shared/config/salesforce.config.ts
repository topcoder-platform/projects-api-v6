/**
 * Salesforce OAuth client-credentials configuration used by the opportunity
 * lookup endpoints.
 *
 * These values are distinct from the JWT-bearer credentials consumed by
 * `BillingAccountService` (`SALESFORCE_CLIENT_ID`/`SALESFORCE_CLIENT_KEY`):
 * the opportunity integration uses a connected app configured for the
 * client-credentials flow, matching the Reports API integration.
 *
 * Values are read from `process.env` on each access so the running process
 * always uses the current environment rather than a snapshot taken at import.
 */
export const SALESFORCE_CONFIG = {
  /**
   * Connected-app consumer key.
   * Env: `SALESFORCE_API_CONSUMER_KEY`.
   */
  get consumerKey(): string {
    return process.env.SALESFORCE_API_CONSUMER_KEY || '';
  },
  /**
   * Connected-app consumer secret.
   * Env: `SALESFORCE_API_CONSUMER_SECRET`.
   */
  get consumerSecret(): string {
    return process.env.SALESFORCE_API_CONSUMER_SECRET || '';
  },
  /**
   * Salesforce origin used for the token exchange.
   * Env: `SALESFORCE_LOGIN_URL`, default: `https://topcoder.my.salesforce.com`.
   */
  get loginUrl(): string {
    return (
      process.env.SALESFORCE_LOGIN_URL || 'https://topcoder.my.salesforce.com'
    );
  },
  /**
   * REST API version, without the leading `v`.
   * Env: `SALESFORCE_REST_API_VERSION`, default: `65.0`.
   */
  get apiVersion(): string {
    return process.env.SALESFORCE_REST_API_VERSION || '65.0';
  },
} as const;
