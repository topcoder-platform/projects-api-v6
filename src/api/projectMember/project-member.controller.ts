import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateProjectMemberDto,
  ProjectMemberResponseDto,
  QueryProjectMemberDto,
  UpdateProjectMemberDto,
} from './project-member.dto';
import { FieldsQueryDto } from '../common/common.dto';
import { ProjectMemberService } from './project-member.service';
import { JwtUser } from 'src/auth/auth.dto';
import { Permission } from 'src/auth/decorators/permissions.decorator';

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
  @ApiOperation({ summary: 'Create project member' })
  @Permission('projectMember.create')
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
    const authUser = req['user'] as JwtUser;
    return this.service.create(authUser, projectId, dto, query);
  }

  /**
   * Searches for project members based on query parameters.
   * @param projectId - Numeric ID of the project to search within
   * @param dto - Query parameters for filtering members
   * @returns Array of project member responses matching criteria
   */
  @Get('/:projectId/members')
  @Permission('projectMember.view')
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
    @Param('projectId') projectId: number,
    @Query() dto: QueryProjectMemberDto,
  ): Promise<ProjectMemberResponseDto[]> {
    return this.service.search(projectId, dto);
  }

  /**
   * Retrieves a specific project member by ID.
   * @param projectId - Numeric ID of the associated project
   * @param id - Numeric ID of the project member to retrieve
   * @param query - Optional fields query for response shaping
   * @returns The requested project member response
   */
  @Get('/:projectId/members/:id')
  @Permission('projectMember.view')
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
    @Param('projectId') projectId: number,
    @Param('id') id: number,
    @Query() query: FieldsQueryDto,
  ): Promise<ProjectMemberResponseDto> {
    return this.service.getMember(projectId, id, query);
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
  @Permission('projectMember.edit')
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
    const authUser = req['user'] as JwtUser;
    return this.service.updateMember(authUser, projectId, id, dto, query);
  }

  /**
   * Removes a member from a project.
   * @param projectId - Numeric ID of the associated project
   * @param id - Numeric ID of the project member to remove
   * @returns Empty promise indicating successful deletion
   */
  @Delete('/:projectId/members/:id')
  @Permission('projectMember.delete')
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
    @Param('projectId') projectId: number,
    @Param('id') id: number,
  ): Promise<void> {
    await this.service.deleteMember(projectId, id);
  }
}
