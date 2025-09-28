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
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  AttachmentResponseDto,
  CreateAttachmentDto,
  UpdateAttachmentDto,
} from './project-attachment.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { RolesScopesGuard } from 'src/auth/guards/roles-scopes.guard';
import { MANAGER_ROLES, USER_ROLE, M2M_SCOPES } from 'src/shared/constants';
import { ProjectAttachmentService } from './project-attachment.service';

/**
 * Controller for handling project attachment operations.
 * Provides RESTful endpoints for creating, retrieving, updating, and deleting project attachments.
 */
@ApiTags('Project Attachment')
@Controller('/projects')
export class ProjectAttachmentController {
  constructor(private readonly service: ProjectAttachmentService) {}

  /**
   * Endpoint for creating a new project attachment.
   * @param req - The incoming request containing authenticated user information
   * @param projectId - The ID of the project to attach to
   * @param dto - Data transfer object containing attachment details
   * @returns The created attachment response
   */
  @Post('/:projectId/attachments')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECTS.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create project attachment' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.CREATED, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async createAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Body() dto: CreateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    return this.service.createAttachment(req, projectId, dto);
  }

  /**
   * Endpoint for retrieving all attachments for a specific project.
   * @param projectId - The ID of the project to get attachments for
   * @returns Array of attachment responses
   */
  @Get('/:projectId/attachments')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT, USER_ROLE.TOPCODER_USER)
  @Scopes(M2M_SCOPES.PROJECTS.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search project attachment' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: AttachmentResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async searchAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: number,
  ): Promise<AttachmentResponseDto[]> {
    return this.service.searchAttachment(req, projectId);
  }

  /**
   * Endpoint for retrieving a specific project attachment.
   * @param projectId - The ID of the associated project
   * @param id - The ID of the attachment to retrieve
   * @returns The requested attachment response
   */
  @Get('/:projectId/attachments/:id')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT, USER_ROLE.TOPCODER_USER)
  @Scopes(M2M_SCOPES.PROJECTS.READ)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get project attachment by project id and attachment id',
  })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'attachment id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async getAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('id') id: number,
  ): Promise<AttachmentResponseDto> {
    return this.service.getAttachment(req, projectId, id);
  }

  /**
   * Endpoint for updating an existing project attachment.
   * @param req - The incoming request containing authenticated user information
   * @param projectId - The ID of the associated project
   * @param id - The ID of the attachment to update
   * @param dto - Data transfer object containing updated attachment details
   * @returns The updated attachment response
   */
  @Patch('/:projectId/attachments/:id')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECTS.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update project attachment' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'attachment id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async updateAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('id') id: number,
    @Body() dto: UpdateAttachmentDto,
  ): Promise<AttachmentResponseDto> {
    return this.service.updateAttachment(req, projectId, id, dto);
  }

  /**
   * Endpoint for deleting a project attachment.
   * @param projectId - The ID of the associated project
   * @param id - The ID of the attachment to delete
   * @returns Empty promise indicating successful deletion
   */
  @Delete('/:projectId/attachments/:id')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECTS.WRITE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete project attachment by project id and attachment id',
  })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'attachment id', type: Number })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Delete Successful',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async deleteAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('id') id: number,
  ): Promise<void> {
    await this.service.deleteAttachment(req, projectId, id);
  }
}
