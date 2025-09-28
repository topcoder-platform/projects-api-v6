import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  BillingAccountResponseDto,
  ListBillingAccountItem,
} from './billing-account.dto';
import { Request } from 'express';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { RolesScopesGuard } from 'src/auth/guards/roles-scopes.guard';
import { MANAGER_ROLES, USER_ROLE, M2M_SCOPES } from 'src/shared/constants';
import { BillingAccountService } from './billing-account.service';

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
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECTS.READ_PROJECT_BILLING_ACCOUNT_DETAILS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get project billing account' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: BillingAccountResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async getAccount(
    @Req() req: Request,
    @Param('projectId') projectId: number,
  ): Promise<BillingAccountResponseDto> {
    return this.service.getAccount(req, projectId);
  }

  /**
   * Endpoint to list all billing accounts associated with a project.
   * @param projectId - The ID of the project to retrieve billing accounts for
   * @returns An array of billing account items
   */
  @Get('/:projectId/billingAccounts')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECTS.READ_USER_BILLING_ACCOUNTS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List project billing accounts' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: ListBillingAccountItem,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async listAccounts(
    @Req() req: Request,
    @Param('projectId') projectId: number,
  ): Promise<ListBillingAccountItem[]> {
    return this.service.listAccounts(req, projectId);
  }
}
