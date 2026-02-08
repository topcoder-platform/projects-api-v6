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
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { setProjectPaginationHeaders } from 'src/shared/utils/pagination.utils';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  GetProjectQueryDto,
  ProjectListQueryDto,
} from './dto/project-list-query.dto';
import { ProjectWithRelationsDto } from './dto/project-response.dto';
import { UpgradeProjectDto } from './dto/upgrade-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('/projects')
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.READ_PROJECT_ANY, Permission.CREATE_PROJECT)
  @ApiOperation({
    summary: 'List projects',
    description:
      'Returns a paginated list of projects with filtering, sorting, and optional relation fields.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiQuery({ name: 'id', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'memberOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'code', required: false, type: String })
  @ApiQuery({ name: 'customer', required: false, type: String })
  @ApiQuery({ name: 'manager', required: false, type: String })
  @ApiQuery({ name: 'directProjectId', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated projects list',
    type: [ProjectWithRelationsDto],
    headers: {
      'X-Prev-Page': {
        description: 'Previous page index',
        schema: { type: 'integer' },
      },
      'X-Next-Page': {
        description: 'Next page index',
        schema: { type: 'integer' },
      },
      'X-Page': {
        description: 'Current page index',
        schema: { type: 'integer' },
      },
      'X-Per-Page': {
        description: 'Items per page',
        schema: { type: 'integer' },
      },
      'X-Total': {
        description: 'Total matching projects',
        schema: { type: 'integer' },
      },
      'X-Total-Pages': {
        description: 'Total number of pages',
        schema: { type: 'integer' },
      },
      Link: {
        description: 'Pagination links',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async listProjects(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() criteria: ProjectListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectWithRelationsDto[]> {
    const result = await this.service.listProjects(criteria, user);

    setProjectPaginationHeaders(
      req,
      res,
      result.page,
      result.perPage,
      result.total,
    );

    return result.data;
  }

  @Get(':projectId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({
    summary: 'Get project by id',
    description: 'Returns one project with optional relation fields.',
  })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiQuery({
    name: 'fields',
    required: false,
    type: String,
    description:
      'CSV fields list. Supported: members, invites, attachments, phases',
  })
  @ApiResponse({
    status: 200,
    description: 'Project details',
    type: ProjectWithRelationsDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getProject(
    @Param('projectId') projectId: string,
    @Query() query: GetProjectQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectWithRelationsDto> {
    return this.service.getProject(projectId, query.fields, user);
  }

  @Get(':projectId/permissions')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get user permissions for project' })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiResponse({
    status: 200,
    description: 'Policy map',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'boolean',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getProjectPermissions(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<Record<string, boolean>> {
    return this.service.getProjectPermissions(projectId, user);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.CREATE_PROJECT)
  @ApiOperation({
    summary: 'Create project',
    description:
      'Creates a new project with optional attachments and estimations.',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({
    status: 201,
    description: 'Created project',
    type: ProjectWithRelationsDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async createProject(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectWithRelationsDto> {
    return this.service.createProject(dto, user);
  }

  @Post(':projectId/upgrade')
  @AdminOnly()
  @ApiOperation({ summary: 'Upgrade project to new template version' })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiBody({ type: UpgradeProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Project upgraded successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async upgradeProject(
    @Param('projectId') projectId: string,
    @Body() dto: UpgradeProjectDto,
    @CurrentUser() user: JwtUser,
  ): Promise<{ message: string }> {
    return this.service.upgradeProject(projectId, dto, user);
  }

  @Patch(':projectId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({
    summary: 'Update project',
    description: 'Partially updates a project by id.',
  })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Updated project',
    type: ProjectWithRelationsDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async updateProject(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectWithRelationsDto> {
    return this.service.updateProject(projectId, dto, user);
  }

  @Delete(':projectId')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.DELETE_PROJECT)
  @ApiOperation({
    summary: 'Delete project',
    description: 'Soft deletes a project by id.',
  })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiResponse({ status: 204, description: 'Project deleted' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async deleteProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteProject(projectId, user);
  }
}
