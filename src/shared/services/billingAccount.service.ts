import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { createPrivateKey, KeyObject } from 'crypto';
import { firstValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { LoggerService } from 'src/shared/modules/global/logger.service';

export interface BillingAccount {
  tcBillingAccountId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  markup?: number;
  [key: string]: unknown;
}

@Injectable()
export class BillingAccountService {
  private readonly logger = LoggerService.forRoot('BillingAccountService');
  private readonly salesforceAudience =
    process.env.SALESFORCE_CLIENT_AUDIENCE ||
    process.env.SALESFORCE_AUDIENCE ||
    '';
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

  constructor(private readonly httpService: HttpService) {}

  async getBillingAccountsForProject(
    projectId: string,
    userId: string,
  ): Promise<BillingAccount[]> {
    if (!this.isSalesforceConfigured()) {
      this.logger.warn('Salesforce integration is not configured.');
      return [];
    }

    try {
      const { accessToken, instanceUrl } = await this.authenticate();
      const escapedUserId = this.escapeSoqlLiteral(userId);
      // Keep tc-project-service behavior: list by current user assignment and active BA.
      const sql = `SELECT Topcoder_Billing_Account__r.Id, Topcoder_Billing_Account__r.TopCoder_Billing_Account_Id__c, Topcoder_Billing_Account__r.Billing_Account_Name__c, Topcoder_Billing_Account__r.Start_Date__c, Topcoder_Billing_Account__r.End_Date__c from Topcoder_Billing_Account_Resource__c tbar where Topcoder_Billing_Account__r.Active__c=true AND UserID__c='${escapedUserId}'`;
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

  async getDefaultBillingAccount(
    billingAccountId: string,
  ): Promise<BillingAccount | null> {
    if (!this.isSalesforceConfigured()) {
      this.logger.warn('Salesforce integration is not configured.');
      return null;
    }

    try {
      const { accessToken, instanceUrl } = await this.authenticate();
      const escapedBillingAccountId = this.escapeSoqlLiteral(billingAccountId);
      const sql = `SELECT TopCoder_Billing_Account_Id__c, Mark_Up__c, Active__c, Start_Date__c, End_Date__c from Topcoder_Billing_Account__c tba where TopCoder_Billing_Account_Id__c='${escapedBillingAccountId}'`;
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

  private isSalesforceConfigured(): boolean {
    return Boolean(
      process.env.SALESFORCE_CLIENT_ID &&
      this.salesforceAudience &&
      process.env.SALESFORCE_SUBJECT &&
      process.env.SALESFORCE_CLIENT_KEY,
    );
  }

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

  private parseIntStrictly(rawValue: string | undefined): string | undefined {
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

  private readAsString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readAsNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private readAsBoolean(value: unknown): boolean | undefined {
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

  private escapeSoqlLiteral(value: string): string {
    return String(value).replace(/'/g, "\\'");
  }

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
