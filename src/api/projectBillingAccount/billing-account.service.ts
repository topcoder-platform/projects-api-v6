/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { SalesforceService } from 'src/shared/services/salesforce.service';
import { PrismaService } from 'src/shared/services/prisma.service';
import { JwtUser } from 'src/auth/auth.dto';
import {
  BillingAccountResponseDto,
  ListBillingAccountItem,
} from './billing-account.dto';

/**
 * Service for handling billing account related operations.
 * Provides methods to retrieve billing account information for projects.
 */
@Injectable()
export class BillingAccountService {
  private readonly logger = new Logger(BillingAccountService.name);

  constructor(
    private readonly salesforceService: SalesforceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Retrieves a single billing account associated with a project.
   * @param req - The request
   * @param projectId - The unique identifier of the project
   * @returns A promise that resolves to the billing account details
   */
  async getAccount(
    req: Request,
    projectId: number,
  ): Promise<BillingAccountResponseDto> {
    const authUser = req['authUser'] as JwtUser;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        billingAccountId: true,
      },
    });
    if (!project) {
      throw new NotFoundException(`Project with id ${projectId} not found`);
    }
    const billingAccountId = project.billingAccountId;
    if (!billingAccountId) {
      throw new NotFoundException('Billing Account not found');
    }

    const { accessToken, instanceUrl } =
      await this.salesforceService.authenticate();

    const sql = `SELECT  TopCoder_Billing_Account_Id__c, Mark_Up__c, Active__c, Start_Date__c, End_Date__c from Topcoder_Billing_Account__c tba where TopCoder_Billing_Account_Id__c='${billingAccountId}'`;
    this.logger.debug(sql);
    const billingAccount = await this.salesforceService.queryBillingAccount(
      sql,
      accessToken,
      instanceUrl,
    );
    if (!authUser.isMachine) {
      // delete sensitive information for non machine access
      // does not revalidate the scope as it assumes that is already taken care
      delete billingAccount.markup;
    }
    return billingAccount;
  }

  /**
   * Retrieves all billing accounts associated with a project.
   * @param req - The request
   * @param projectId - The unique identifier of the project
   * @returns A promise that resolves to an array of billing account items
   */
  async listAccounts(
    req: Request,
    projectId: number, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<ListBillingAccountItem[]> {
    const authUser = req['authUser'] as JwtUser;

    const { accessToken, instanceUrl } =
      await this.salesforceService.authenticate();

    const sql = `SELECT  Topcoder_Billing_Account__r.id, Topcoder_Billing_Account__r.TopCoder_Billing_Account_Id__c, Topcoder_Billing_Account__r.Billing_Account_Name__c, Topcoder_Billing_Account__r.Start_Date__c, Topcoder_Billing_Account__r.End_Date__c from Topcoder_Billing_Account_Resource__c tbar where Topcoder_Billing_Account__r.Active__c=true AND UserID__c='${authUser.userId}'`;
    // and Topcoder_Billing_Account__r.TC_Connect_Project_ID__c='${projectId}'
    this.logger.debug(sql);
    const billingAccounts =
      await this.salesforceService.queryUserBillingAccounts(
        sql,
        accessToken,
        instanceUrl,
      );
    return billingAccounts;
  }
}
