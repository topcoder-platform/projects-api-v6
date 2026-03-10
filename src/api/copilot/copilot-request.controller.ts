import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { Request, Response } from 'express';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { setProjectPaginationHeaders } from 'src/shared/utils/pagination.utils';
import { CopilotRequestService } from './copilot-request.service';
import {
  CopilotRequestListQueryDto,
  CopilotRequestResponseDto,
  CreateCopilotRequestDto,
  UpdateCopilotRequestDto,
} from './dto/copilot-request.dto';

@ApiTags('Copilot Requests')
@ApiBearerAuth()
@Controller('/projects')
@UseGuards(PermissionGuard)
@Roles(UserRole.PROJECT_MANAGER, UserRole.TOPCODER_ADMIN)
@Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
@RequirePermission(Permission.MANAGE_COPILOT_REQUEST)
/**
 * Exposes copilot request CRUD and approval endpoints under /projects.
 * All endpoints require MANAGE_COPILOT_REQUEST permission and are restricted
 * to PROJECT_MANAGER and TOPCODER_ADMIN roles.
 */
export class CopilotRequestController {
  constructor(private readonly service: CopilotRequestService) {}

  /**
   * GET /projects/copilots/requests
   * Cross-project request listing endpoint that sets pagination headers.
   *
   * @param req Express request.
   * @param res Express response.
   * @param query Pagination/sort query.
   * @param user Authenticated JWT user.
   * @returns Copilot request page data.
   */
  @Get('copilots/requests')
  @ApiOperation({
    summary: 'List all copilot requests',
    description:
      'Lists copilot requests across projects. Supports pagination and sorting.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiResponse({ status: 200, type: [CopilotRequestResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async listAllRequests(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: CopilotRequestListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotRequestResponseDto[]> {
    const result = await this.service.listRequests(undefined, query, user);

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
   * GET /projects/copilots/requests/:copilotRequestId
   * Returns one copilot request.
   *
   * @param copilotRequestId Copilot request id path value.
   * @param user Authenticated JWT user.
   * @returns One copilot request response.
   */
  @Get('copilots/requests/:copilotRequestId')
  @ApiOperation({
    summary: 'Get copilot request',
    description: 'Returns one copilot request by id.',
  })
  @ApiParam({ name: 'copilotRequestId', required: true, type: String })
  @ApiResponse({ status: 200, type: CopilotRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getRequest(
    @Param('copilotRequestId') copilotRequestId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    return this.service.getRequest(copilotRequestId, user);
  }

  /**
   * PATCH /projects/copilots/requests/:copilotRequestId
   * Partial request update endpoint; terminal statuses are rejected.
   *
   * @param copilotRequestId Copilot request id path value.
   * @param dto Patch payload.
   * @param user Authenticated JWT user.
   * @returns Updated request response.
   */
  @Patch('copilots/requests/:copilotRequestId')
  @ApiOperation({
    summary: 'Update copilot request',
    description:
      'Partially updates a copilot request. Canceled and fulfilled requests cannot be updated.',
  })
  @ApiParam({ name: 'copilotRequestId', required: true, type: String })
  @ApiBody({ type: UpdateCopilotRequestDto })
  @ApiResponse({ status: 200, type: CopilotRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateRequest(
    @Param('copilotRequestId') copilotRequestId: string,
    @Body() dto: UpdateCopilotRequestDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    return this.service.updateRequest(copilotRequestId, dto, user);
  }

  /**
   * GET /projects/:projectId/copilots/requests
   * Project-scoped request list endpoint that sets pagination headers.
   *
   * @param req Express request.
   * @param res Express response.
   * @param projectId Project id path value.
   * @param query Pagination/sort query.
   * @param user Authenticated JWT user.
   * @returns Project request page data.
   */
  @Get(':projectId/copilots/requests')
  @ApiOperation({
    summary: 'List copilot requests for project',
    description:
      'Lists copilot requests for a specific project with pagination and sorting.',
  })
  @ApiParam({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiResponse({ status: 200, type: [CopilotRequestResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listProjectRequests(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('projectId') projectId: string,
    @Query() query: CopilotRequestListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotRequestResponseDto[]> {
    const result = await this.service.listRequests(projectId, query, user);

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
   * POST /projects/copilots/requests
   * Creates a request using data.projectId from the request body.
   *
   * @param dto Create request payload.
   * @param user Authenticated JWT user.
   * @returns Created request response.
   */
  @Post('copilots/requests')
  @ApiOperation({
    summary: 'Create copilot request',
    description:
      'Creates a new copilot request and auto-approves it by creating a matching opportunity. Uses data.projectId from the payload.',
  })
  @ApiBody({ type: CreateCopilotRequestDto })
  @ApiResponse({ status: 201, type: CopilotRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async createRequestFromPayloadProject(
    @Body() dto: CreateCopilotRequestDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    return this.service.createRequest(String(dto.data.projectId), dto, user);
  }

  /**
   * POST /projects/:projectId/copilots/requests
   * Creates a request using projectId from the path.
   *
   * @param projectId Project id path value.
   * @param dto Create request payload.
   * @param user Authenticated JWT user.
   * @returns Created request response.
   */
  @Post(':projectId/copilots/requests')
  @ApiOperation({
    summary: 'Create copilot request',
    description:
      'Creates a new copilot request and auto-approves it by creating a matching opportunity.',
  })
  @ApiParam({ name: 'projectId', required: true, type: String })
  @ApiBody({ type: CreateCopilotRequestDto })
  @ApiResponse({ status: 201, type: CopilotRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async createRequest(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCopilotRequestDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotRequestResponseDto> {
    return this.service.createRequest(projectId, dto, user);
  }

  /**
   * POST /projects/:projectId/copilots/requests/:copilotRequestId/approve
   * Approves request and creates opportunity, with optional type override in body.
   *
   * @param projectId Project id path value.
   * @param copilotRequestId Copilot request id path value.
   * @param type Optional opportunity type override.
   * @param user Authenticated JWT user.
   * @returns Created opportunity payload.
   */
  @Post(':projectId/copilots/requests/:copilotRequestId/approve')
  @ApiOperation({
    summary: 'Approve copilot request',
    description:
      'Approves an existing request and creates an active copilot opportunity.',
  })
  @ApiParam({ name: 'projectId', required: true, type: String })
  @ApiParam({ name: 'copilotRequestId', required: true, type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Optional override for opportunity type.',
        },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Opportunity created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async approveRequest(
    @Param('projectId') projectId: string,
    @Param('copilotRequestId') copilotRequestId: string,
    @Body('type') type: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.approveRequest(projectId, copilotRequestId, type, user);
  }
}
