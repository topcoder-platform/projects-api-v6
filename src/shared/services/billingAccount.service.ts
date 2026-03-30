import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { createPrivateKey, KeyObject } from 'crypto';
import { firstValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { SERVICE_ENDPOINTS } from '../config/service-endpoints.config';
import { M2MService } from './m2m.service';

export interface BillingAccount {
  tcBillingAccountId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  markup?: number;
  [key: string]: unknown;
}

/**
 * Salesforce billing-account integration service.
 *
 * Uses JWT Bearer OAuth against Salesforce and runs SOQL queries to retrieve
 * billing-account data used by Projects API.
 *
 * Injected into the billing-account controller for account listing/detail
 * endpoints. Requires `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_AUDIENCE`
 * (or `SALESFORCE_AUDIENCE`), `SALESFORCE_SUBJECT`, and
 * `SALESFORCE_CLIENT_KEY`.
 */
@Injectable()
export class BillingAccountService {
  private readonly logger = new Logger(BillingAccountService.name);
  private readonly billingAccountsApiUrl =
    SERVICE_ENDPOINTS.billingAccountsApiUrl.replace(/\/+$/, '');
  private readonly salesforceAudience =
    process.env.SALESFORCE_CLIENT_AUDIENCE ||
    process.env.SALESFORCE_AUDIENCE ||
    '';
  // TODO: document why salesforceAudience is a valid fallback for the login URL, or remove this fallback.
  private readonly salesforceLoginBaseUrl =
    process.env.SALESFORCE_LOGIN_BASE_URL ||
    this.salesforceAudience ||
    'https://login.salesforce.com';
  private readonly salesforceApiVersion =
    process.env.SALESFORCE_API_VERSION || 'v37.0';
  private readonly sfdcBillingAccountNameField =
    process.env.SFDC_BILLING_ACCOUNT_NAME_FIELD || 'Billing_Account_name__c';
  private readonly sfdcBillingAccountMarkupField =
    process.env.SFDC_BILLING_ACCOUNT_MARKUP_FIELD || 'Mark_Up__c';
  private readonly sfdcBillingAccountActiveField =
    process.env.SFDC_BILLING_ACCOUNT_ACTIVE_FIELD || 'Active__c';

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

  /**
   * Returns billing accounts available to the current project user.
   *
   * Queries `Topcoder_Billing_Account_Resource__c` by `UserID__c`.
   *
   * @param projectId project id used for logging context
   * @param userId Topcoder user id
   * @returns billing-account list for the user
   */
  async getBillingAccountsForProject(
    projectId: string,
    userId: string,
  ): Promise<BillingAccount[]> {
    if (!this.isSalesforceConfigured()) {
      this.logger.warn('Salesforce integration is not configured.');
      return [];
    }

    try {
      const normalizedUserId = this.parseIntStrictly(userId);
      if (!normalizedUserId) {
        this.logger.warn(
          `Invalid userId while listing billing accounts for projectId=${projectId}.`,
        );
        return [];
      }

      // TODO (security + performance): cache the Salesforce access token until its expiry to reduce token surface area and latency.
      const { accessToken, instanceUrl } = await this.authenticate();
      // Keep tc-project-service behavior: list by current user assignment and active BA.
      // SECURITY: SOQL injection mitigated by parseIntStrictly integer validation. If this validation is ever relaxed, parameterized queries must be used.
      const sql = `SELECT Topcoder_Billing_Account__r.Id, Topcoder_Billing_Account__r.TopCoder_Billing_Account_Id__c, Topcoder_Billing_Account__r.Billing_Account_Name__c, Topcoder_Billing_Account__r.Start_Date__c, Topcoder_Billing_Account__r.End_Date__c from Topcoder_Billing_Account_Resource__c tbar where Topcoder_Billing_Account__r.Active__c=true AND UserID__c='${normalizedUserId}'`;
      this.logger.debug(sql);

      const records = await this.queryBillingAccountRecords(
        sql,
        accessToken,
        instanceUrl,
      );

      return records.map((record) => ({
        sfBillingAccountId: this.readAsString(
          record?.Topcoder_Billing_Account__r?.Id,
        ),
        tcBillingAccountId: this.parseIntStrictly(
          this.readAsString(
            record?.Topcoder_Billing_Account__r?.TopCoder_Billing_Account_Id__c,
          ),
        ),
        name: this.readAsString(
          record?.Topcoder_Billing_Account__r?.[
            this.sfdcBillingAccountNameField
          ],
        ),
        startDate: this.readAsString(
          record?.Topcoder_Billing_Account__r?.Start_Date__c,
        ),
        endDate: this.readAsString(
          record?.Topcoder_Billing_Account__r?.End_Date__c,
        ),
      }));
    } catch (error) {
      this.logger.warn(
        `Unable to fetch billing accounts for projectId=${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  /**
   * Returns the default billing-account record by Topcoder billing-account id.
   *
   * Queries `Topcoder_Billing_Account__c` by
   * `TopCoder_Billing_Account_Id__c`.
   *
   * @param billingAccountId Topcoder billing-account id
   * @returns billing-account details, or `null` when not found/invalid
   */
  async getDefaultBillingAccount(
    billingAccountId: string,
  ): Promise<BillingAccount | null> {
    try {
      const normalizedBillingAccountId =
        this.parseIntStrictly(billingAccountId);
      if (!normalizedBillingAccountId) {
        this.logger.warn(
          `Invalid billingAccountId received while fetching default billing account: ${billingAccountId}`,
        );
        return null;
      }

      const billingAccountFromApi =
        await this.getBillingAccountFromBillingAccountsApi(
          normalizedBillingAccountId,
        );
      if (billingAccountFromApi) {
        return billingAccountFromApi;
      }

      if (!this.isSalesforceConfigured()) {
        this.logger.warn('Salesforce integration is not configured.');
        return null;
      }

      const { accessToken, instanceUrl } = await this.authenticate();
      // SECURITY: SOQL injection mitigated by parseIntStrictly integer validation. If this validation is ever relaxed, parameterized queries must be used.
      const sql = `SELECT TopCoder_Billing_Account_Id__c, Mark_Up__c, Active__c, Start_Date__c, End_Date__c from Topcoder_Billing_Account__c tba where TopCoder_Billing_Account_Id__c='${normalizedBillingAccountId}'`;
      this.logger.debug(sql);

      const records = await this.queryBillingAccountRecords(
        sql,
        accessToken,
        instanceUrl,
      );

      const firstRecord = records[0];
      if (!firstRecord || typeof firstRecord !== 'object') {
        return null;
      }

      return {
        tcBillingAccountId: this.parseIntStrictly(
          this.readAsString(firstRecord.TopCoder_Billing_Account_Id__c),
        ),
        markup: this.readAsNumber(
          firstRecord[this.sfdcBillingAccountMarkupField],
        ),
        active: this.readAsBoolean(
          firstRecord[this.sfdcBillingAccountActiveField],
        ),
        startDate: this.readAsString(firstRecord.Start_Date__c),
        endDate: this.readAsString(firstRecord.End_Date__c),
      };
    } catch (error) {
      this.logger.warn(
        `Unable to fetch default billing account for billingAccountId=${billingAccountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Resolves a billing-account record from the Billing Accounts API.
   *
   * Uses a service M2M token and maps the DB-backed response into the legacy
   * billing-account shape exposed by Projects API.
   *
   * @param billingAccountId normalized Topcoder billing-account id
   * @returns normalized billing-account details or `null` when lookup fails
   */
  private async getBillingAccountFromBillingAccountsApi(
    billingAccountId: string,
  ): Promise<BillingAccount | null> {
    if (!this.billingAccountsApiUrl) {
      return null;
    }

    try {
      const token = await this.m2mService.getM2mToken();
      const response = await firstValueFrom(
        this.httpService.get(`${this.billingAccountsApiUrl}/${billingAccountId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }),
      );

      const payload =
        response?.data && typeof response.data === 'object'
          ? (response.data as Record<string, unknown>)
          : undefined;
      const normalizedBillingAccountId = this.parseIntStrictly(
        this.readAsIdString(payload?.tcBillingAccountId) ||
          this.readAsIdString(payload?.id),
      );

      if (!normalizedBillingAccountId) {
        return null;
      }

      return {
        tcBillingAccountId: normalizedBillingAccountId,
        name: this.readAsString(payload?.name),
        startDate: this.readAsString(payload?.startDate),
        endDate: this.readAsString(payload?.endDate),
        active:
          this.readAsBoolean(payload?.active) ??
          this.readActiveFlagFromStatus(payload?.status),
        markup: this.readAsNumber(payload?.markup),
      };
    } catch (error) {
      this.logger.warn(
        `Unable to fetch default billing account from Billing Accounts API for billingAccountId=${billingAccountId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Returns a map of billing-account details keyed by Topcoder account id.
   *
   * Executes a single SOQL query with an `IN` clause over normalized ids.
   *
   * @param billingAccountIds billing-account ids to fetch
   * @returns record keyed by normalized billing-account id
   */
  async getBillingAccountsByIds(
    billingAccountIds: string[],
  ): Promise<Record<string, BillingAccount>> {
    const normalizedBillingAccountIds = Array.from(
      new Set(
        billingAccountIds
          .map((billingAccountId) => this.parseIntStrictly(billingAccountId))
          .filter((billingAccountId): billingAccountId is string =>
            Boolean(billingAccountId),
          ),
      ),
    );

    if (normalizedBillingAccountIds.length === 0) {
      return {};
    }

    if (!this.isSalesforceConfigured()) {
      this.logger.warn('Salesforce integration is not configured.');
      return {};
    }

    try {
      const { accessToken, instanceUrl } = await this.authenticate();
      const inClause = normalizedBillingAccountIds
        .map((billingAccountId) => `'${billingAccountId}'`)
        .join(',');
      // SECURITY: SOQL injection mitigated by parseIntStrictly integer validation. If this validation is ever relaxed, parameterized queries must be used.
      const sql = `SELECT TopCoder_Billing_Account_Id__c, ${this.sfdcBillingAccountNameField}, Start_Date__c, End_Date__c, ${this.sfdcBillingAccountActiveField} from Topcoder_Billing_Account__c tba where TopCoder_Billing_Account_Id__c IN (${inClause})`;
      this.logger.debug(sql);

      const records = await this.queryBillingAccountRecords(
        sql,
        accessToken,
        instanceUrl,
      );

      return records.reduce<Record<string, BillingAccount>>((acc, record) => {
        const normalizedBillingAccountId = this.parseIntStrictly(
          this.readAsString(record?.TopCoder_Billing_Account_Id__c),
        );

        if (!normalizedBillingAccountId) {
          return acc;
        }

        acc[normalizedBillingAccountId] = {
          tcBillingAccountId: normalizedBillingAccountId,
          name: this.readAsString(record?.[this.sfdcBillingAccountNameField]),
          startDate: this.readAsString(record?.Start_Date__c),
          endDate: this.readAsString(record?.End_Date__c),
          active: this.readAsBoolean(
            record?.[this.sfdcBillingAccountActiveField],
          ),
        };

        return acc;
      }, {});
    } catch (error) {
      this.logger.warn(
        `Unable to fetch billing accounts by ids: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {};
    }
  }

  /**
   * Checks whether required Salesforce auth configuration exists.
   *
   * @returns `true` when required env vars are present
   */
  private isSalesforceConfigured(): boolean {
    return Boolean(
      process.env.SALESFORCE_CLIENT_ID &&
      this.salesforceAudience &&
      process.env.SALESFORCE_SUBJECT &&
      process.env.SALESFORCE_CLIENT_KEY,
    );
  }

  /**
   * Authenticates to Salesforce using JWT Bearer OAuth.
   *
   * Signs an RS256 JWT assertion and exchanges it for an access token +
   * instance URL.
   *
   * @returns Salesforce auth session
   * @throws Error when Salesforce returns an invalid auth response
   */
  private async authenticate(): Promise<{
    accessToken: string;
    instanceUrl: string;
  }> {
    const clientId = process.env.SALESFORCE_CLIENT_ID || '';
    const audience = this.salesforceAudience;
    const subject = process.env.SALESFORCE_SUBJECT || '';
    const privateKey = this.normalizePrivateKey(
      process.env.SALESFORCE_CLIENT_KEY || '',
    );
    // TODO: parse and cache the private KeyObject at construction time.
    const privateKeyObject = this.toPrivateKeyObject(privateKey);

    const assertion = jwt.sign({}, privateKeyObject, {
      expiresIn: '1h',
      issuer: clientId,
      audience,
      subject,
      algorithm: 'RS256',
    });

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.salesforceLoginBaseUrl}/services/oauth2/token`,
        new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );

    const accessToken = this.readAsString(response?.data?.access_token);
    const instanceUrl = this.readAsString(response?.data?.instance_url);

    if (!accessToken || !instanceUrl) {
      throw new Error('Salesforce authentication response is invalid.');
    }

    return {
      accessToken,
      instanceUrl,
    };
  }

  /**
   * Executes a SOQL query and returns Salesforce `records`.
   *
   * @param sql SOQL query string
   * @param accessToken Salesforce OAuth access token
   * @param instanceUrl Salesforce instance base URL
   * @returns Salesforce records array (empty when payload shape is unexpected)
   */
  private async queryBillingAccountRecords(
    sql: string,
    accessToken: string,
    instanceUrl: string,
  ): Promise<Record<string, any>[]> {
    const response = await firstValueFrom(
      this.httpService.get(
        `${instanceUrl}/services/data/${this.salesforceApiVersion}/query`,
        {
          params: {
            q: sql,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      ),
    );

    const records = response?.data?.records;
    if (!Array.isArray(records)) {
      return [];
    }

    return records as Record<string, any>[];
  }

  /**
   * Validates that a value is a strict integer string and normalizes it.
   *
   * @param rawValue candidate value
   * @returns normalized integer string or `undefined` when invalid
   */
  private parseIntStrictly(rawValue: string | undefined): string | undefined {
    // TODO: rename to toIntegerString or validateIntegerString for clarity.
    if (!rawValue) {
      return undefined;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      return undefined;
    }

    if (String(parsed) !== rawValue) {
      return undefined;
    }

    return String(parsed);
  }

  /**
   * Coerces a Salesforce field value to a non-empty trimmed string.
   *
   * @param value raw field value
   * @returns trimmed string or `undefined`
   */
  private readAsString(value: unknown): string | undefined {
    // TODO: extract to a shared SalesforceUtils module if other Salesforce integrations are added.
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Coerces a scalar identifier to a trimmed string for strict integer
   * validation.
   *
   * @param value raw identifier value
   * @returns trimmed identifier string or `undefined`
   */
  private readAsIdString(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    return this.readAsString(value);
  }

  /**
   * Coerces a Salesforce field value to a finite number.
   *
   * @param value raw field value
   * @returns parsed number or `undefined`
   */
  private readAsNumber(value: unknown): number | undefined {
    // TODO: extract to a shared SalesforceUtils module if other Salesforce integrations are added.
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  /**
   * Coerces a Salesforce field value to boolean.
   *
   * @param value raw field value
   * @returns boolean value or `undefined`
   */
  private readAsBoolean(value: unknown): boolean | undefined {
    // TODO: extract to a shared SalesforceUtils module if other Salesforce integrations are added.
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }
    }

    return undefined;
  }

  /**
   * Maps billing-account status strings to the legacy `active` flag.
   *
   * @param value raw status value
   * @returns active flag when the status is recognized
   */
  private readActiveFlagFromStatus(value: unknown): boolean | undefined {
    const normalizedStatus = this.readAsString(value)?.toUpperCase();

    if (normalizedStatus === 'ACTIVE') {
      return true;
    }

    if (normalizedStatus === 'INACTIVE') {
      return false;
    }

    return undefined;
  }

  /**
   * Normalizes private-key input from multiple secret-storage formats.
   *
   * Supports quoted PEM strings, escaped newlines, one-line space-separated
   * PEM bodies, and base64-encoded PEM text.
   *
   * @param rawKey raw private-key value
   * @returns normalized PEM string
   */
  private normalizePrivateKey(rawKey: string): string {
    let normalized = String(rawKey || '').trim();

    // Some secret stores keep the whole PEM wrapped in quotes.
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      normalized = normalized.slice(1, -1);
    }

    // Support escaped newlines, including double-escaped forms.
    while (normalized.includes('\\n')) {
      normalized = normalized.replace(/\\n/g, '\n');
    }

    // Support one-line PEM values where body chunks are separated by spaces.
    // This is used for local dev reading from AWS parameter store via the SSM python script
    // we use for loading configs from parameter store into the local env.
    // Example:
    // -----BEGIN PRIVATE KEY----- ABC... XYZ... -----END PRIVATE KEY-----
    const pemMatch = normalized.match(
      /-----BEGIN ([A-Z0-9 ]+)-----\s*([A-Za-z0-9+/=\s]+)\s*-----END \1-----/s,
    );
    if (pemMatch) {
      const [, keyType, keyBody] = pemMatch;
      const compactBody = keyBody.replace(/\s+/g, '');
      if (compactBody.length > 0) {
        const wrappedBody = compactBody.match(/.{1,64}/g)?.join('\n') || '';
        normalized = [
          `-----BEGIN ${keyType}-----`,
          wrappedBody,
          `-----END ${keyType}-----`,
        ].join('\n');
      }
    }

    if (!normalized.includes('-----BEGIN')) {
      try {
        const decoded = Buffer.from(normalized, 'base64').toString('utf8');
        if (decoded.includes('-----BEGIN')) {
          normalized = decoded;
        }
      } catch {
        // keep original value; validation below will produce clear error
      }
    }

    return normalized.trim();
  }

  /**
   * Converts PEM text into a Node.js `KeyObject`.
   *
   * @param privateKey PEM private key
   * @returns parsed key object
   * @throws Error with descriptive message when key format is invalid
   */
  private toPrivateKeyObject(privateKey: string): KeyObject {
    try {
      return createPrivateKey({
        key: privateKey,
        format: 'pem',
      });
    } catch (error) {
      throw new Error(
        `Invalid SALESFORCE_CLIENT_KEY format: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
