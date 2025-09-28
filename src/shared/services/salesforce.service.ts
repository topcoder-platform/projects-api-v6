/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import Utils from 'src/shared/utils';
import * as jwt from 'jsonwebtoken';
import { SalesforceConfig } from '../../../config/config';
import { get } from 'lodash';

@Injectable()
export class SalesforceService {
  private readonly logger = new Logger(SalesforceService.name);
  private readonly salesforceConfig;
  private loginBaseUrl;
  private privateKey;

  constructor(private readonly httpService: HttpService) {
    this.salesforceConfig = SalesforceConfig();
    this.loginBaseUrl =
      this.salesforceConfig.clientAudience || 'https://login.salesforce.com';
    this.privateKey = this.salesforceConfig.clientKey || 'privateKey';
    // we are using dummy private key to fail safe when key is not provided in env
    this.privateKey = this.privateKey.replace(/\\n/g, '\n');
  }

  private urlEncodeForm(k) {
    return Object.keys(k).reduce(
      (a, b) => `${a}&${b}=${encodeURIComponent(k[b])}`,
      '',
    );
  }

  /**
   * Authenticate to Salesforce with pre-configured credentials
   * @returns {{accessToken: String, instanceUrl: String}} the result
   */
  async authenticate() {
    try {
      const jwtToken = jwt.sign({}, this.privateKey, {
        expiresIn: '1h', // any expiration
        issuer: this.salesforceConfig.clientId,
        audience: this.salesforceConfig.clientAudience,
        subject: this.salesforceConfig.subject,
        algorithm: 'RS256',
      });

      const res: any = await firstValueFrom(
        this.httpService.post(
          `${this.loginBaseUrl}/services/oauth2/token`,
          this.urlEncodeForm({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwtToken,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );
      return {
        accessToken: res.data.access_token,
        instanceUrl: res.data.instance_url,
      };
    } catch (err) {
      this.logger.error(
        'Error occurs while authenticating from salesforce',
        err,
      );
      throw new InternalServerErrorException(
        'Error occurs while authenticating from salesforce',
      );
    }
  }

  /**
   * Run the query statement
   * @param {String} sql the Salesforce sql statement
   * @param {String} accessToken the access token
   * @param {String} instanceUrl the salesforce instance url
   * @returns {{totalSize: Number, done: Boolean, records: Array}} the result
   */
  async queryUserBillingAccounts(sql, accessToken, instanceUrl) {
    try {
      const res: any = await firstValueFrom(
        this.httpService.get(
          `${instanceUrl}/services/data/v37.0/query?q=${sql}`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
        ),
      );
      this.logger.debug(get(res, 'data.records', []));
      const billingAccounts = get(res, 'data.records', []).map((o) => ({
        sfBillingAccountId: get(o, 'Topcoder_Billing_Account__r.Id'),
        tcBillingAccountId: Utils.parseIntStrictly(
          get(o, 'Topcoder_Billing_Account__r.TopCoder_Billing_Account_Id__c'),
          10,
          null, // fallback to null if cannot parse
        ),
        name: get(
          o,
          `Topcoder_Billing_Account__r.${this.salesforceConfig.sfdcBillingAccountNameField}`,
        ),
        startDate: get(o, 'Topcoder_Billing_Account__r.Start_Date__c'),
        endDate: get(o, 'Topcoder_Billing_Account__r.End_Date__c'),
      }));
      return billingAccounts;
    } catch (err) {
      this.logger.error(
        'Error occurs while querying user billing accounts',
        err,
      );
      throw new InternalServerErrorException(
        'Error occurs while querying user billing accounts',
      );
    }
  }

  /**
   * Run the query statement
   * @param {String} sql the Salesforce sql statement
   * @param {String} accessToken the access token
   * @param {String} instanceUrl the salesforce instance url
   * @returns {{totalSize: Number, done: Boolean, records: Array}} the result
   */
  async queryBillingAccount(sql, accessToken, instanceUrl) {
    try {
      const res: any = await firstValueFrom(
        this.httpService.get(
          `${instanceUrl}/services/data/v37.0/query?q=${sql}`,
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
            },
          },
        ),
      );
      this.logger.debug(get(res, 'data.records', []));
      const billingAccounts = get(res, 'data.records', []).map((o) => ({
        tcBillingAccountId: Utils.parseIntStrictly(
          get(o, 'TopCoder_Billing_Account_Id__c'),
          10,
          null, // fallback to null if cannot parse
        ),
        markup: get(o, this.salesforceConfig.sfdcBillingAccountMarkupField),
        active: get(o, this.salesforceConfig.sfdcBillingAccountActiveField),
        startDate: get(o, 'Start_Date__c'),
        endDate: get(o, 'End_Date__c'),
      }));
      return billingAccounts.length > 0 ? billingAccounts[0] : {};
    } catch (err) {
      this.logger.error('Error occurs while querying billing account', err);
      throw new InternalServerErrorException(
        'Error occurs while querying billing account',
      );
    }
  }
}
