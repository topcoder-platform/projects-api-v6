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
import { BillingAccount } from 'src/shared/services/billingAccount.service';
import { setProjectPaginationHeaders } from 'src/shared/utils/pagination.utils';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  GetProjectQueryDto,
  ProjectListQueryDto,
} from './dto/project-list-query.dto';
import { ProjectWithRelationsDto } from './dto/project-response.dto';
import { UpgradeProjectDto } from './dto/upgrade-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectPermissionsResponse, ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('/projects')
/**
 * REST controller for the `/projects` resource.
 *
 * Handles CRUD operations, billing-account sub-resources, permissions lookup,
 * and admin upgrade actions for projects. Access control relies on
 * `PermissionGuard` together with `@Roles`, `@Scopes`, and
 * `@RequirePermission` decorators applied on handlers.
 *
 * @todo `@Roles(...Object.values(UserRole))` is repeated on every handler and
 * should be hoisted to class level.
 */
export class ProjectController {
  constructor(private readonly service: ProjectService) {}

  /**
   * Lists projects using paging, filters, and optional relation fields.
   *
   * @param req Express request used for pagination-link generation.
   * @param res Express response where paging headers are set.
   * @param criteria Project list query criteria.
   * @param user Authenticated caller context.
   * @returns Project list payload; pagination metadata is returned in headers.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller lacks required scope/permission.
   * @security Pagination depends on DTO validation (`perPage` max 200); there
   * is no additional DB-level hard cap in this handler/service path.
   */
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
  @ApiQuery({ name: 'billingAccountId', required: false, type: String })
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

  /**
   * Gets a single project by id.
   *
   * @param projectId Project id path parameter.
   * @param query Query object with optional `fields` CSV.
   * @param user Authenticated caller context.
   * @returns A project resource with optional relations.
   * @throws BadRequestException When `projectId` is not numeric.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller cannot view the project.
   * @throws NotFoundException When the project is missing.
   */
  @Get(':projectId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_READ, Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL)
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
    description: 'CSV fields list. Supported: members, invites, attachments',
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

  /**
   * Lists billing accounts available for a project in caller context.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Billing accounts available to the caller.
   * @throws BadRequestException When `projectId` is not numeric.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller lacks required permissions.
   * @security Requires `CONNECT_PROJECT_ADMIN` or
   * `PROJECTS_READ_USER_BILLING_ACCOUNTS` scope.
   */
  @Get(':projectId/billingAccounts')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.CONNECT_PROJECT_ADMIN,
    Scope.PROJECTS_READ_USER_BILLING_ACCOUNTS,
  )
  @RequirePermission(Permission.READ_AVL_PROJECT_BILLING_ACCOUNTS)
  @ApiOperation({
    summary: 'List available billing accounts for project',
    description:
      'Returns billing accounts available to the caller in the context of a project.',
  })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing accounts list',
    schema: {
      type: 'array',
      items: {
        type: 'object',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async listProjectBillingAccounts(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<BillingAccount[]> {
    return this.service.listProjectBillingAccounts(projectId, user);
  }

  /**
   * Gets the default billing account associated with a project.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Default project billing-account details.
   * @throws BadRequestException When `projectId` is not numeric.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller lacks required permissions.
   * @throws NotFoundException When project or billing account is missing.
   * @security The service strips `markup` for copilot-only callers before
   * returning the response payload.
   */
  @Get(':projectId/billingAccount')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS)
  @RequirePermission(Permission.READ_PROJECT_BILLING_ACCOUNT_DETAILS)
  @ApiOperation({
    summary: 'Get default billing account for project',
    description:
      'Returns billing account details for the project-level default billing account.',
  })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing account details',
    schema: {
      type: 'object',
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getProjectBillingAccount(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<BillingAccount> {
    return this.service.getProjectBillingAccount(projectId, user);
  }

  /**
   * Returns project permissions for the caller or, for M2M, every project user.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns Non-privileged human callers receive a caller policy map. M2M,
   * admins, global project managers, global talent managers, and project
   * copilots on the requested project receive a per-user matrix containing
   * memberships, Topcoder roles, named project permissions, and template
   * work-management policies.
   * @throws BadRequestException When `projectId` is not numeric.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When caller cannot access the project.
   * @throws NotFoundException When the project is missing.
   */
  @Get(':projectId/permissions')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT, {
    topcoderRoles: [
      UserRole.PROJECT_MANAGER,
      UserRole.TALENT_MANAGER,
      UserRole.TOPCODER_TALENT_MANAGER,
    ],
  })
  @ApiOperation({ summary: 'Get user permissions for project' })
  @ApiParam({
    name: 'projectId',
    required: true,
    description: 'Project numeric id',
  })
  @ApiResponse({
    status: 200,
    description:
      'Caller policy map for regular human JWTs, or a per-user permission matrix for M2M/admin/project-manager/talent-manager/project-copilot callers',
    schema: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: {
            type: 'boolean',
          },
        },
        {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              memberships: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    memberId: {
                      type: 'string',
                    },
                    role: {
                      type: 'string',
                    },
                    isPrimary: {
                      type: 'boolean',
                    },
                  },
                },
              },
              topcoderRoles: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              projectPermissions: {
                type: 'object',
                additionalProperties: {
                  type: 'boolean',
                },
              },
              workManagementPolicies: {
                type: 'object',
                additionalProperties: {
                  type: 'boolean',
                },
              },
            },
          },
        },
      ],
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
  ): Promise<ProjectPermissionsResponse> {
    return this.service.getProjectPermissions(projectId, user);
  }

  /**
   * Creates a new project with optional nested records.
   *
   * @param dto Project creation payload.
   * @param user Authenticated caller context.
   * @returns Newly created project.
   * @throws BadRequestException For invalid input values.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller lacks create permissions.
   * @throws NotFoundException When dependent referenced data is missing.
   * Publishes a `project.created` lifecycle event on success.
   */
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

  /**
   * Upgrades a project to a supported target version.
   *
   * @param projectId Project id path parameter.
   * @param dto Upgrade payload.
   * @param user Authenticated caller context.
   * @returns Success message; current implementation supports only `v3`.
   * @throws BadRequestException For unsupported upgrade arguments.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller is not an admin.
   * @throws NotFoundException When the project is missing.
   */
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

  /**
   * Partially updates a project.
   *
   * @param projectId Project id path parameter.
   * @param dto Patch payload.
   * @param user Authenticated caller context.
   * @returns Updated project.
   * @throws BadRequestException For invalid update fields.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller lacks edit permissions.
   * @throws NotFoundException When the project is missing.
   * Publishes a `project.updated` lifecycle event on success.
   */
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

  /**
   * Soft-deletes a project.
   *
   * @param projectId Project id path parameter.
   * @param user Authenticated caller context.
   * @returns No content.
   * @throws BadRequestException When `projectId` is not numeric.
   * @throws UnauthorizedException When the caller is unauthenticated.
   * @throws ForbiddenException When the caller lacks delete permissions.
   * @throws NotFoundException When the project is missing.
   * Publishes a `project.deleted` lifecycle event on success.
   */
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
