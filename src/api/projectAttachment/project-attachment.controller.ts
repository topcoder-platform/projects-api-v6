import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AttachmentResponseDto, CreateAttachmentDto, UpdateAttachmentDto } from "./project-attachment.dto";
import { JwtUser } from "src/auth/auth.dto";
import { ProjectAttachmentService } from "./project-attachment.service";
import { Permission } from "src/auth/decorators/permissions.decorator";

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
  @ApiOperation({ summary: 'Create project attachment' })
  @Permission('projectAttachment.create')
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.CREATED, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async createAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() dto: CreateAttachmentDto
  ): Promise<AttachmentResponseDto> {
    const authUser = req['user'] as JwtUser;
    return this.service.createAttachment(authUser, projectId, dto);
  }

  /**
   * Endpoint for retrieving all attachments for a specific project.
   * @param projectId - The ID of the project to get attachments for
   * @returns Array of attachment responses
   */
  @Get('/:projectId/attachments')
  @Permission('projectAttachment.view')
  @ApiOperation({ summary: 'Search project attachment' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, isArray: true, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async searchAttachment(
    @Param('projectId') projectId: string,
  ): Promise<AttachmentResponseDto[]> {
    return this.service.searchAttachment(projectId);
  }

  /**
   * Endpoint for retrieving a specific project attachment.
   * @param projectId - The ID of the associated project
   * @param id - The ID of the attachment to retrieve
   * @returns The requested attachment response
   */
  @Get('/:projectId/attachments/:id')
  @Permission('projectAttachment.view')
  @ApiOperation({ summary: 'Get project attachment by project id and attachment id' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'attachment id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async getAttachment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<AttachmentResponseDto> {
    return this.service.getAttachment(projectId, id);
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
  @Permission('projectAttachment.edit')
  @ApiOperation({ summary: 'Update project attachment' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'attachment id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: AttachmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async updateAttachment(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttachmentDto
  ): Promise<AttachmentResponseDto> {
    const authUser = req['user'] as JwtUser;
    return this.service.updateAttachment(authUser, projectId, id, dto);
  }

  /**
   * Endpoint for deleting a project attachment.
   * @param projectId - The ID of the associated project
   * @param id - The ID of the attachment to delete
   * @returns Empty promise indicating successful deletion
   */
  @Delete('/:projectId/attachments/:id')
  @Permission('projectAttachment.delete')
  @ApiOperation({ summary: 'Delete project attachment by project id and attachment id' })
  @ApiParam({ name: 'projectId', description: 'project id', type: Number })
  @ApiParam({ name: 'id', description: 'attachment id', type: Number })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Delete Successful' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async deleteAttachment(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.deleteAttachment(projectId, id);
  }
}
