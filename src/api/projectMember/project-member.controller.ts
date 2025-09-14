import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import {
  CreateProjectMemberDto,
  ProjectMemberResponseDto,
  QueryProjectMemberDto,
  UpdateProjectMemberDto,
} from './project-member.dto';
import { FieldsQueryDto } from '../common/common.dto';
import { ProjectMemberService } from './project-member.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { RolesScopesGuard } from 'src/auth/guards/roles-scopes.guard';
import { MANAGER_ROLES, USER_ROLE, M2M_SCOPES } from 'src/shared/constants';

/**
 * Controller for managing project members.
 * Handles CRUD operations for project members including creation, retrieval,
 * updating, and deletion of member records.
 */
@ApiTags('Project Member')
@Controller('/projects')
export class ProjectMemberController {
  constructor(private readonly service: ProjectMemberService) {}

  /**
   * Creates a new project member association.
   * @param req - The incoming request containing authenticated user
   * @param projectId - Numeric ID of the project to add member to
   * @param dto - Data transfer object with member details
   * @param query - Optional fields query for response shaping
   * @returns The created project member response
   */
  @Post('/:projectId/members')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECT_MEMBERS.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create project member' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProjectMemberResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async create(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Body() dto: CreateProjectMemberDto,
    @Query() query: FieldsQueryDto,
  ): Promise<ProjectMemberResponseDto> {
    return this.service.create(req, projectId, dto, query);
  }

  /**
   * Searches for project members based on query parameters.
   * @param projectId - Numeric ID of the project to search within
   * @param dto - Query parameters for filtering members
   * @returns Array of project member responses matching criteria
   */
  @Get('/:projectId/members')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT, USER_ROLE.TOPCODER_USER)
  @Scopes(M2M_SCOPES.PROJECT_MEMBERS.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search project member with given parameters' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: ProjectMemberResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async search(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Query() dto: QueryProjectMemberDto,
  ): Promise<ProjectMemberResponseDto[]> {
    return this.service.search(projectId, dto, req);
  }

  /**
   * Retrieves a specific project member by ID.
   * @param projectId - Numeric ID of the associated project
   * @param id - Numeric ID of the project member to retrieve
   * @param query - Optional fields query for response shaping
   * @returns The requested project member response
   */
  @Get('/:projectId/members/:id')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT, USER_ROLE.TOPCODER_USER)
  @Scopes(M2M_SCOPES.PROJECT_MEMBERS.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search project member with given parameters' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'project member id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ProjectMemberResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async getMember(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('id') id: number,
    @Query() query: FieldsQueryDto,
  ): Promise<ProjectMemberResponseDto> {
    return this.service.getMember(projectId, id, query, req);
  }

  /**
   * Updates an existing project member's details.
   * @param req - The incoming request containing authenticated user
   * @param projectId - Numeric ID of the associated project
   * @param id - Numeric ID of the project member to update
   * @param dto - Data transfer object with updated member details
   * @param query - Optional fields query for response shaping
   * @returns The updated project member response
   */
  @Patch('/:projectId/members/:id')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECT_MEMBERS.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search project member with given parameters' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'project member id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: ProjectMemberResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async updateMember(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('id') id: number,
    @Body() dto: UpdateProjectMemberDto,
    @Query() query: FieldsQueryDto,
  ): Promise<ProjectMemberResponseDto> {
    return this.service.updateMember(projectId, id, dto, query, req);
  }

  /**
   * Removes a member from a project.
   * @param projectId - Numeric ID of the associated project
   * @param id - Numeric ID of the project member to remove
   * @returns Empty promise indicating successful deletion
   */
  @Delete('/:projectId/members/:id')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECT_MEMBERS.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search project member with given parameters' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'project member id', type: Number })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Operation successful',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async deleteMember(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('id') id: number,
  ): Promise<void> {
    await this.service.deleteMember(projectId, id, req);
  }
}
