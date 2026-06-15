import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingAccountService as BillingAccountLookupService,
} from '../../shared/services/billingAccount.service';
import type { BillingAccount } from '../../shared/services/billingAccount.service';
import { PrismaService } from '../../shared/services/prisma.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccountLookupService: BillingAccountLookupService,
  ) {}

  /**
   * Retrieves a single billing account associated with a project.
   *
   * @param projectId - The unique identifier of the project.
   * @returns A promise that resolves to the default billing-account details
   * for the project. When the project has no billing account, all fields are
   * returned as `null`.
   * @throws BadRequestException when `projectId` is not a positive integer.
   * @throws NotFoundException when the project does not exist.
   */
  async getAccount(projectId: string): Promise<BillingAccountResponseDto> {
    const billingAccountId = await this.getProjectBillingAccountId(projectId);

    if (!billingAccountId) {
      return this.toBillingAccountResponse(null, null);
    }

    const billingAccount =
      await this.billingAccountLookupService.getDefaultBillingAccount(
        billingAccountId,
      );

    return this.toBillingAccountResponse(billingAccountId, billingAccount);
  }

  /**
   * Retrieves all billing accounts associated with a project.
   *
   * @param projectId - The unique identifier of the project.
   * @param userId - The authenticated Topcoder user id used by Salesforce
   * resource assignments.
   * @returns A promise that resolves to billing accounts available to the
   * current user for project workflows.
   * @throws BadRequestException when `projectId` is not a positive integer.
   * @throws NotFoundException when the project does not exist.
   */
  async listAccounts(
    projectId: string,
    userId?: string,
  ): Promise<ListBillingAccountItem[]> {
    await this.ensureProjectExists(projectId);

    if (!userId) {
      return [];
    }

    const billingAccounts =
      await this.billingAccountLookupService.getBillingAccountsForProject(
        projectId,
        userId,
      );

    return billingAccounts.map((billingAccount) =>
      this.toListBillingAccountItem(billingAccount),
    );
  }

  /**
   * Resolves the default project billing-account id.
   *
   * @param projectId - The unique identifier of the project.
   * @returns The project billing-account id as a string, or `null` when the
   * project has no default billing account.
   * @throws BadRequestException when `projectId` is not a positive integer.
   * @throws NotFoundException when the project does not exist.
   */
  private async getProjectBillingAccountId(
    projectId: string,
  ): Promise<string | null> {
    const project = await this.getProjectBillingFields(projectId);

    return project.billingAccountId?.toString() ?? null;
  }

  /**
   * Verifies that a project exists.
   *
   * @param projectId - The unique identifier of the project.
   * @returns A promise that resolves when the project exists.
   * @throws BadRequestException when `projectId` is not a positive integer.
   * @throws NotFoundException when the project does not exist.
   */
  private async ensureProjectExists(projectId: string): Promise<void> {
    await this.getProjectBillingFields(projectId);
  }

  /**
   * Loads only the project fields needed by billing-account endpoints.
   *
   * @param projectId - The unique identifier of the project.
   * @returns Project billing fields from persistence.
   * @throws BadRequestException when `projectId` is not a positive integer.
   * @throws NotFoundException when the project does not exist.
   */
  private async getProjectBillingFields(
    projectId: string,
  ): Promise<{ billingAccountId: bigint | null }> {
    const normalizedProjectId = this.normalizeProjectId(projectId);
    const project = await this.prisma.project.findUnique({
      select: {
        billingAccountId: true,
      },
      where: {
        id: normalizedProjectId,
      },
    });

    if (!project) {
      throw new NotFoundException(`Not found project of id ${projectId}`);
    }

    return project;
  }

  /**
   * Normalizes route project ids before Prisma queries.
   *
   * @param projectId - Raw route project id.
   * @returns Positive integer project id as a bigint.
   * @throws BadRequestException when `projectId` is not a positive integer.
   */
  private normalizeProjectId(projectId: string): bigint {
    const normalizedProjectId = String(projectId ?? '').trim();

    if (!/^[1-9]\d*$/.test(normalizedProjectId)) {
      throw new BadRequestException('Project id must be a positive integer.');
    }

    return BigInt(normalizedProjectId);
  }

  /**
   * Maps billing-account details to the project endpoint response shape.
   *
   * @param fallbackBillingAccountId - Project billing-account id used when
   * upstream details are unavailable.
   * @param billingAccount - Billing-account details resolved from the Billing
   * Accounts API or Salesforce.
   * @returns Billing-account response DTO.
   */
  private toBillingAccountResponse(
    fallbackBillingAccountId: string | null,
    billingAccount: BillingAccount | null,
  ): BillingAccountResponseDto {
    return {
      active: billingAccount?.active ?? null,
      endDate: billingAccount?.endDate ?? null,
      markup: billingAccount?.markup ?? null,
      startDate: billingAccount?.startDate ?? null,
      tcBillingAccountId:
        billingAccount?.tcBillingAccountId ?? fallbackBillingAccountId,
    };
  }

  /**
   * Maps billing-account summaries to the list endpoint response shape.
   *
   * @param billingAccount - Billing-account details resolved from Salesforce.
   * @returns Billing-account list item DTO.
   */
  private toListBillingAccountItem(
    billingAccount: BillingAccount,
  ): ListBillingAccountItem {
    return {
      endDate: billingAccount.endDate ?? null,
      name: billingAccount.name ?? null,
      sfBillingAccountId:
        typeof billingAccount.sfBillingAccountId === 'string'
          ? billingAccount.sfBillingAccountId
          : null,
      startDate: billingAccount.startDate ?? null,
      tcBillingAccountId: billingAccount.tcBillingAccountId ?? null,
    };
  }
}
