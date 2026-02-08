import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
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
  private readonly billingAccountBaseUrl =
    process.env.BILLING_ACCOUNT_SERVICE_URL ||
    process.env.SALESFORCE_API_URL ||
    '';

  constructor(
    private readonly httpService: HttpService,
    private readonly m2mService: M2MService,
  ) {}

  async getBillingAccountsForProject(
    projectId: string,
  ): Promise<BillingAccount[]> {
    if (!this.billingAccountBaseUrl) {
      this.logger.warn('Billing account base URL is not configured.');
      return [];
    }

    try {
      const token = await this.m2mService.getM2MToken();

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.billingAccountBaseUrl}/projects/${projectId}/billingAccounts`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      if (!Array.isArray(response.data)) {
        return [];
      }

      return response.data as BillingAccount[];
    } catch (error) {
      this.logger.warn(
        `Unable to fetch billing accounts for projectId=${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getDefaultBillingAccount(
    projectId: string,
  ): Promise<BillingAccount | null> {
    if (!this.billingAccountBaseUrl) {
      this.logger.warn('Billing account base URL is not configured.');
      return null;
    }

    try {
      const token = await this.m2mService.getM2MToken();

      const response = await firstValueFrom(
        this.httpService.get(
          `${this.billingAccountBaseUrl}/projects/${projectId}/billingAccount`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      );

      if (!response.data || typeof response.data !== 'object') {
        return null;
      }

      return response.data as BillingAccount;
    } catch (error) {
      this.logger.warn(
        `Unable to fetch default billing account for projectId=${projectId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
