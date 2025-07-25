import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, HttpStatus, Query } from '@nestjs/common';
import { CreateProjectDto, ProjectResponseDto, QueryProjectDto, UpdateProjectDto } from './project.dto';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../auth/decorators/permissions.decorator';
import { JwtUser } from 'src/auth/auth.dto';
import { ProjectService } from './project.service';
import { JwtRequired } from 'src/auth/decorators/jwt.decorator';

/**
 * Controller for handling project-related HTTP requests
 */
@ApiTags('Project')
@Controller('/projects')
export class ProjectsController {

  constructor(private readonly service: ProjectService) {}

  /**
   * Create a new project
   * @param req request
   * @param dto request dto
   * @returns ProjectResponseDto
   */
  @Post()
  @JwtRequired()
  @Permission('project.create')
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async createProject(
    @Req() req: Request,
    @Body() dto: CreateProjectDto
  ): Promise<ProjectResponseDto> {
    const authUser = req['user'] as JwtUser; // Extract authenticated user from request
    return this.service.createProject(authUser, dto); // Delegate to service
  }

  /**
   * Search/filter projects
   * @param dto search query parameters
   * @returns array of ProjectResponseDto
   */
  @Get()
  @ApiOperation({ summary: 'Search project' })
  @ApiResponse({ status: HttpStatus.OK, isArray: true, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async searchProject(
    @Query() dto: QueryProjectDto
  ): Promise<ProjectResponseDto[]> {
    return this.service.searchProject(dto); // Delegate to service
  }

  /**
   * Get single project by ID
   * @param projectId project id
   * @returns ProjectResponseDto
   */
  @Get('/:projectId')
  @JwtRequired()
  @Permission('project.view')
  @ApiOperation({ summary: 'Get project by id' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async getProject(
    @Param('projectId') projectId: string,
  ): Promise<ProjectResponseDto> {
    return this.service.getProject(projectId); // Delegate to service
  }

  /**
   * Update existing project by ID
   * @param req request
   * @param projectId project id
   * @param dto request dto
   * @returns ProjectResponseDto
   */
  @Patch('/:projectId')
  @JwtRequired()
  @Permission('project.edit')
  @ApiOperation({ summary: 'Update project by id' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async updateProject(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto
  ): Promise<ProjectResponseDto> {
    const authUser = req['user'] as JwtUser; // Extract authenticated user from request
    return this.service.updateProject(authUser, projectId, dto); // Delegate to service
  }

  /**
   * Delete project by ID
   * @param projectId project id
   */
  @Delete('/:projectId')
  @JwtRequired()
  @Permission('project.delete')
  @ApiOperation({ summary: 'Delete project by id' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Delete successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async deleteProject(
    @Param('projectId') projectId: string
  ): Promise<void> {
    await this.service.deleteProject(projectId);
  }
}
