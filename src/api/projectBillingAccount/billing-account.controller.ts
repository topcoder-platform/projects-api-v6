import { Controller, Get, HttpStatus, Param, Req } from '@nestjs/common';
import {
  BillingAccountResponseDto,
  ListBillingAccountItem,
} from './billing-account.dto';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BillingAccountService } from './billing-account.service';
import { Request } from 'express';
import { JwtUser } from '../../auth/auth.dto';

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
    @Param('projectId') projectId: string,
  ): Promise<BillingAccountResponseDto> {
    return this.service.getAccount(projectId);
  }

  /**
   * Endpoint to list all billing accounts associated with a project.
   * @param projectId - The ID of the project to retrieve billing accounts for
   * @param req - The HTTP request containing the authenticated user, when available
   * @returns An array of billing account items
   */
  @Get('/:projectId/billingAccounts')
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
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<ListBillingAccountItem[]> {
    const authUser = req['authUser'] as JwtUser | undefined;

    return this.service.listAccounts(projectId, authUser?.userId?.toString());
  }
}
