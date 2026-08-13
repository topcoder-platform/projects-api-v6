import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CopilotApplicationStatus,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { Request, Response } from 'express';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { Public } from 'src/shared/decorators/public.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import {
  OptionalAuthenticated,
  Roles,
} from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { setProjectPaginationHeaders } from 'src/shared/utils/pagination.utils';
import { CopilotOpportunityService } from './copilot-opportunity.service';
import { AssignCopilotDto } from './dto/copilot-application.dto';
import {
  CopilotOpportunityResponseDto,
  ListOpportunitiesQueryDto,
} from './dto/copilot-opportunity.dto';

@ApiTags('Copilot Opportunities')
@ApiBearerAuth()
@Controller('/projects')
/**
 * Exposes opportunity browsing endpoints for authenticated users and
 * privileged assignment/cancellation endpoints for admins/PMs.
 */
export class CopilotOpportunityController {
  constructor(private readonly service: CopilotOpportunityService) {}

  /**
   * GET /projects/copilots/opportunities
   * Lists opportunities for all authenticated roles and sets pagination headers.
   *
   * @param req Express request.
   * @param res Express response.
   * @param query Pagination/sort query.
   * @param user Authenticated JWT user.
   * @returns Opportunity page data.
   */
  @Get('copilots/opportunities')
  @Public()
  @OptionalAuthenticated()
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @ApiOperation({
    summary: 'List copilot opportunities',
    description:
      'Lists copilot opportunities using database-side filtering, sorting, and pagination. Supports discovery by search text, opportunity/application state, project, type, skills, and dates. This route remains public; current-user application filters and enrichment require an authenticated numeric user id. Admin and manager callers also receive minimal nested project metadata for v5 compatibility.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Page size from 1 to 200 (default 20).',
  })
  @ApiQuery({
    name: 'perPage',
    required: false,
    type: Number,
    description: 'Compatibility alias for pageSize.',
    deprecated: true,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description:
      'Sort by createdAt, updatedAt, status, type, projectName, opportunityTitle, or startDate, followed by asc or desc.',
    example: 'createdAt desc',
  })
  @ApiQuery({ name: 'noGrouping', required: false, type: Boolean })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Case-insensitive search across title, overview, project name, type, and skills.',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: 'Compatibility alias for search.',
    deprecated: true,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CopilotOpportunityStatus,
    isArray: true,
    description:
      'Comma-separated/repeated statuses; legacy status[$in] is also accepted.',
  })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'projectName', required: false, type: String })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CopilotOpportunityType,
    isArray: true,
  })
  @ApiQuery({
    name: 'projectType',
    required: false,
    enum: CopilotOpportunityType,
    isArray: true,
    description: 'Compatibility alias for type.',
    deprecated: true,
  })
  @ApiQuery({
    name: 'skills',
    required: false,
    type: String,
    isArray: true,
    description: 'Skill ids or names; matches any supplied skill.',
  })
  @ApiQuery({
    name: 'skill',
    required: false,
    type: String,
    isArray: true,
    description: 'Compatibility alias for skills.',
    deprecated: true,
  })
  @ApiQuery({ name: 'startDateFrom', required: false, type: String })
  @ApiQuery({ name: 'startDateTo', required: false, type: String })
  @ApiQuery({ name: 'createdAtFrom', required: false, type: String })
  @ApiQuery({ name: 'createdAtTo', required: false, type: String })
  @ApiQuery({
    name: 'applied',
    required: false,
    type: Boolean,
    description:
      'Filter by whether the current authenticated user has applied.',
  })
  @ApiQuery({
    name: 'myApplications',
    required: false,
    type: Boolean,
    description: 'Compatibility alias for applied=true.',
    deprecated: true,
  })
  @ApiQuery({
    name: 'applicationStatus',
    required: false,
    enum: CopilotApplicationStatus,
    isArray: true,
    description:
      'Filter current-user applications by status; implies applied=true.',
  })
  @ApiResponse({ status: 200, type: [CopilotOpportunityResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async listOpportunities(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ListOpportunitiesQueryDto,
    @CurrentUser() user: JwtUser | undefined,
  ): Promise<CopilotOpportunityResponseDto[]> {
    const result = await this.service.listOpportunities(query, user);

    setProjectPaginationHeaders(
      req,
      res,
      result.page,
      result.perPage,
      result.total,
    );

    return result.data;
  }

  /**
   * GET /projects/copilot/opportunity/:id
   * GET /projects/copilots/opportunity/:id
   * Returns one opportunity response.
   *
   * @param id Opportunity id path value.
   * @param user Authenticated JWT user.
   * @returns One opportunity response.
   */
  @Get(['copilot/opportunity/:id', 'copilots/opportunity/:id'])
  @Public()
  @OptionalAuthenticated()
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @ApiOperation({
    summary: 'Get copilot opportunity',
    description:
      'Returns one copilot opportunity with flattened request data and apply eligibility context for /projects/copilots/opportunity/:id. Admin and manager callers also receive minimal nested project metadata for v5 compatibility.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, type: CopilotOpportunityResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOpportunity(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser | undefined,
  ): Promise<CopilotOpportunityResponseDto> {
    return this.service.getOpportunity(id, user);
  }

  /**
   * POST /projects/copilots/opportunity/:id/assign
   * Assigns an application with full assignment transaction behavior.
   *
   * @param id Opportunity id path value.
   * @param dto Assignment payload.
   * @param user Authenticated JWT user.
   * @returns Assigned application id payload.
   */
  @Post('copilots/opportunity/:id/assign')
  @UseGuards(PermissionGuard)
  @Roles(UserRole.PROJECT_MANAGER, UserRole.TOPCODER_ADMIN)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.ASSIGN_COPILOT_OPPORTUNITY)
  @ApiOperation({
    summary: 'Assign copilot to opportunity',
    description:
      'Accepts one application, assigns the copilot to project members, fulfills the request, completes the opportunity, and cancels other applications.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiBody({ type: AssignCopilotDto })
  @ApiResponse({ status: 200, description: 'Copilot assigned' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @HttpCode(200)
  async assignCopilot(
    @Param('id') id: string,
    @Body() dto: AssignCopilotDto,
    @CurrentUser() user: JwtUser,
  ): Promise<{ id: string }> {
    return this.service.assignCopilot(id, dto, user);
  }

  /**
   * DELETE /projects/copilots/opportunity/:id/cancel
   * Cancels an opportunity and related applications.
   *
   * @param id Opportunity id path value.
   * @param user Authenticated JWT user.
   * @returns Canceled opportunity id payload.
   */
  @Delete('copilots/opportunity/:id/cancel')
  @UseGuards(PermissionGuard)
  @Roles(UserRole.PROJECT_MANAGER, UserRole.TOPCODER_ADMIN)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.CANCEL_COPILOT_OPPORTUNITY)
  @ApiOperation({
    summary: 'Cancel copilot opportunity',
    description:
      'Cancels an opportunity and all related applications, then sends notifications to applicants.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Opportunity canceled' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async cancelOpportunity(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<{ id: string }> {
    return this.service.cancelOpportunity(id, user);
  }
}
