import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { WORK_LAYER_ALLOWED_ROLES } from 'src/shared/constants/roles';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import {
  CreateWorkStreamDto,
  UpdateWorkStreamDto,
  WorkStreamGetCriteria,
  WorkStreamListCriteria,
  WorkStreamResponseDto,
} from './workstream.dto';
import { WorkStreamService } from './workstream.service';

@ApiTags('WorkStream')
@ApiBearerAuth()
@Controller('/projects/:projectId/workstreams')
/**
 * REST controller for work streams under `/projects/:projectId/workstreams`.
 * Work streams are containers for works (project phases) linked via the
 * `phase_work_streams` join table. Route-level auth accepts any known human
 * role and defers the final allow/deny decision to `PermissionGuard`, which
 * preserves legacy project-view access for project members and manager-tier
 * roles. Used by the platform-ui Work app.
 */
export class WorkStreamController {
  constructor(private readonly service: WorkStreamService) {}

  /**
   * Lists project work streams.
   *
   * @param projectId - Project id from the route.
   * @param criteria - Pagination/filter/sort criteria.
   * @returns Work stream DTO list.
   * @throws {BadRequestException} When route id or criteria are invalid.
   * @throws {NotFoundException} When project is not found.
   */
  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORKSTREAM_VIEW)
  @ApiOperation({
    summary: 'List work streams',
    description: 'Returns work streams for a project with optional filtering.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiResponse({ status: 200, type: [WorkStreamResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async listWorkStreams(
    @Param('projectId') projectId: string,
    @Query() criteria: WorkStreamListCriteria,
  ): Promise<WorkStreamResponseDto[]> {
    return this.service.findAll(projectId, criteria);
  }

  /**
   * Creates a work stream under a project.
   *
   * @param projectId - Project id from the route.
   * @param dto - Create payload.
   * @param user - Authenticated user.
   * @returns Created work stream DTO.
   * @throws {BadRequestException} When input is invalid.
   * @throws {NotFoundException} When project is not found.
   */
  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORKSTREAM_CREATE)
  @ApiOperation({
    summary: 'Create work stream',
    description:
      'Creates a work stream under a project. Work stream is a container for works (project phases).',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiBody({ type: CreateWorkStreamDto })
  @ApiResponse({ status: 201, type: WorkStreamResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async createWorkStream(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkStreamDto,
    @CurrentUser() user: JwtUser,
  ): Promise<WorkStreamResponseDto> {
    return this.service.create(projectId, dto, user.userId);
  }

  /**
   * Fetches one work stream, optionally including linked works when
   * `includeWorks=true`.
   *
   * @param projectId - Project id from the route.
   * @param id - Work stream id from the route.
   * @param query - Get criteria including `includeWorks`.
   * @returns Work stream DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When project or work stream is not found.
   */
  @Get(':id')
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORKSTREAM_VIEW)
  @ApiOperation({
    summary: 'Get work stream',
    description:
      'Returns one work stream. Set includeWorks=true to include linked works (project phases).',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Work stream id' })
  @ApiResponse({ status: 200, type: WorkStreamResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getWorkStream(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query() query: WorkStreamGetCriteria,
  ): Promise<WorkStreamResponseDto> {
    return this.service.findOne(projectId, id, query.includeWorks === true);
  }

  /**
   * Partially updates mutable work stream fields.
   *
   * @param projectId - Project id from the route.
   * @param id - Work stream id from the route.
   * @param dto - Update payload.
   * @param user - Authenticated user.
   * @returns Updated work stream DTO.
   * @throws {BadRequestException} When route ids or payload are invalid.
   * @throws {NotFoundException} When project or work stream is not found.
   */
  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORKSTREAM_EDIT)
  @ApiOperation({
    summary: 'Update work stream',
    description: 'Updates mutable work stream fields.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Work stream id' })
  @ApiBody({ type: UpdateWorkStreamDto })
  @ApiResponse({ status: 200, type: WorkStreamResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async updateWorkStream(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkStreamDto,
    @CurrentUser() user: JwtUser,
  ): Promise<WorkStreamResponseDto> {
    return this.service.update(projectId, id, dto, user.userId);
  }

  /**
   * Soft deletes a work stream.
   *
   * @param projectId - Project id from the route.
   * @param id - Work stream id from the route.
   * @param user - Authenticated user.
   * @returns Nothing.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {NotFoundException} When project or work stream is not found.
   */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORKSTREAM_DELETE)
  @ApiOperation({
    summary: 'Delete work stream',
    description: 'Soft deletes a work stream.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Work stream id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async deleteWorkStream(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.delete(projectId, id, user.userId);
  }
}
