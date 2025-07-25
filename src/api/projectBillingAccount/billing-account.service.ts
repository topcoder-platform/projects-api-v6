import { Injectable } from "@nestjs/common";
import { BillingAccountResponseDto, ListBillingAccountItem } from "./billing-account.dto";

/**
 * Service for handling billing account related operations.
 * Provides methods to retrieve billing account information for projects.
 */
@Injectable()
export class BillingAccountService {

  /**
   * Retrieves a single billing account associated with a project.
   * @param projectId - The unique identifier of the project
   * @returns A promise that resolves to the billing account details
   */
  async getAccount(
    projectId: string,
  ): Promise<BillingAccountResponseDto> {
    return new BillingAccountResponseDto();
  }

  /**
   * Retrieves all billing accounts associated with a project.
   * @param projectId - The unique identifier of the project
   * @returns A promise that resolves to an array of billing account items
   */
  async listAccounts(
    projectId: string,
  ): Promise<ListBillingAccountItem[]> {
    return [new ListBillingAccountItem()];
  }
}
