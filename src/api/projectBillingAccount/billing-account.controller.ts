import { Controller, Get, HttpStatus, Param } from "@nestjs/common";
import { BillingAccountResponseDto, ListBillingAccountItem } from "./billing-account.dto";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { BillingAccountService } from "./billing-account.service";
import { Permission } from "src/auth/decorators/permissions.decorator";

/**
 * Controller for handling project billing account operations.
 * Provides RESTful endpoints for retrieving billing account information.
 */
@ApiTags('Project Billing Account')
@Controller('/projects')
export class BillingAccountController {
  constructor(private readonly service: BillingAccountService) {}

  /**
   * Endpoint to retrieve a specific billing account for a project.
   * @param projectId - The ID of the project associated with the billing account
   * @returns A single billing account response DTO
   */
  @Get('/:projectId/billingAccount')
  @Permission('projectBillingAccount.view')
  @ApiOperation({ summary: 'Get project billing account' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: BillingAccountResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async getAccount(
    @Param('projectId') projectId: string,
  ): Promise<BillingAccountResponseDto> {
    return this.service.getAccount(projectId);
  }

  /**
   * Endpoint to list all billing accounts associated with a project.
   * @param projectId - The ID of the project to retrieve billing accounts for
   * @returns An array of billing account items
   */
  @Get('/:projectId/billingAccounts')
  @Permission('projectBillingAccounts.view')
  @ApiOperation({ summary: 'List project billing accounts' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, isArray: true, type: ListBillingAccountItem })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async listAccounts(
    @Param('projectId') projectId: string,
  ): Promise<ListBillingAccountItem[]> {
    return this.service.listAccounts(projectId);
  }
}
