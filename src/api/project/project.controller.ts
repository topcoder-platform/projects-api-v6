import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Res,
  HttpStatus,
  Query,
  ParseIntPipe,
  HttpCode,
} from '@nestjs/common';
import {
  CreateProjectDto,
  ProjectResponseDto,
  QueryProjectDto,
  UpdateProjectDto,
  ProjectCriteria,
} from './project.dto';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Permission } from '../../auth/decorators/permissions.decorator';
import { ProjectService } from './project.service';
import { JwtRequired } from 'src/auth/decorators/jwt.decorator';
import Utils from 'src/shared/utils';

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
  @ApiBearerAuth()
  @Permission('project.create')
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: HttpStatus.CREATED, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async createProject(
    @Req() req: Request,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.service.createProject(dto, req); // Delegate to service
  }

  /**
   * Search/filter projects
   * @param dto search query parameters
   * @returns array of ProjectResponseDto
   */
  @Get()
  @JwtRequired()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search project' })
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: ProjectResponseDto,
    headers: {
      'X-Next-Page': {
        description: 'The index of the next page',
        schema: {
          type: 'integer',
        },
      },
      'X-Page': {
        description: 'The index of the current page (starting at 1)',
        schema: {
          type: 'integer',
        },
      },
      'X-Per-Page': {
        description: 'The number of items to list per page',
        schema: {
          type: 'integer',
        },
      },
      'X-Total': {
        description: 'The total number of items',
        schema: {
          type: 'integer',
        },
      },
      'X-Total-Pages': {
        description: 'The total number of pages',
        schema: {
          type: 'integer',
        },
      },
      Link: {
        description: 'Pagination link header',
        schema: {
          type: 'integer',
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async searchProject(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() dto: QueryProjectDto,
  ): Promise<ProjectResponseDto[]> {
    const result = await this.service.searchProject(dto, req); // Delegate to service

    Utils.setResHeaders(req, res, result);

    return result.data;
  }

  /**
   * Get single project by ID
   * @param projectId project id
   * @returns ProjectResponseDto
   */
  @Get('/:projectId')
  @JwtRequired()
  @ApiBearerAuth()
  @Permission('project.view')
  @ApiOperation({ summary: 'Get project by id' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async getProject(
    @Req() req: Request,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query() criteria: ProjectCriteria,
  ): Promise<ProjectResponseDto> {
    return this.service.getProject(projectId, criteria, req); // Delegate to service
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
  @ApiBearerAuth()
  @Permission('project.edit')
  @ApiOperation({ summary: 'Update project by id' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.OK, type: ProjectResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async updateProject(
    @Req() req: Request,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.service.updateProject(projectId, dto, req); // Delegate to service
  }

  /**
   * Delete project by ID
   * @param projectId project id
   */
  @Delete('/:projectId')
  @JwtRequired()
  @ApiBearerAuth()
  @Permission('project.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project by id' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Delete successfully',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async deleteProject(
    @Req() req: Request,
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<void> {
    await this.service.deleteProject(projectId, req);
  }
}
