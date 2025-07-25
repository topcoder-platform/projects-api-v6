import { Body, Controller, Delete, Get, HttpStatus, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { CreateInviteDto, CreateInviteResponseDto, InviteResponseDto, UpdateInviteDto } from "./project-member-invite.dto";
import { FieldsQueryDto } from "../common/common.dto";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtUser } from "src/auth/auth.dto";
import { ProjectMemberInviteService } from "./project-member-invite.service";
import { Permission } from "src/auth/decorators/permissions.decorator";

/**
 * Controller for handling project member invitation operations.
 * Provides endpoints for creating, retrieving, updating, and deleting project member invites.
 */
@ApiTags('Project Member Invite')
@Controller('/projects')
export class ProjectMemberInviteController {

  constructor(private readonly service: ProjectMemberInviteService) {}

  /**
   * Endpoint for creating a new project member invitation.
   * @param req - The incoming request object
   * @param projectId - The ID of the project to invite to
   * @param dto - Data transfer object containing invitation details
   * @param query - Optional fields query for response shaping
   * @returns The created invitation response
   */
  @Post('/:projectId/invites')
  @Permission('projectMemberInvite.create')
  @ApiOperation({ summary: 'Create Project member invites' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CreateInviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async createInvite(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() dto: CreateInviteDto,
    @Query() query: FieldsQueryDto
  ): Promise<CreateInviteResponseDto> {
    const authUser = req['user'] as JwtUser;
    return this.service.createInvite(authUser, projectId, dto, query);
  }

  /**
   * Endpoint for searching project member invitations.
   * Returns all invitations if user has view permission, otherwise only returns user's own invitations.
   * @param projectId - The ID of the project to search invites for
   * @param query - Optional fields query for filtering and response shaping
   * @returns An array of invitation responses
   */
  @Get('/:projectId/invites')
  @Permission('projectMemberInvite.view')
  @ApiOperation({ summary: 'If user can "view" this project, he/she can get all invitations. Otherwise user can only see his/her own invitation in this project. If user has no invitation in this project or this project doesn\'t exist, an empty array will be returned.'})
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.OK, isArray: true, type: InviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async searchInvite(
    @Param('projectId') projectId: string,
    @Query() query: FieldsQueryDto
  ): Promise<InviteResponseDto[]> {
    return this.service.searchInvite(projectId, query);
  }

  /**
   * Endpoint for retrieving a specific project member invitation.
   * @param projectId - The ID of the associated project
   * @param inviteId - The ID of the invite to retrieve
   * @param query - Optional fields query for response shaping
   * @returns The requested invitation response
   */
  @Get('/:projectId/invites/:inviteId')
  @Permission('projectMemberInvite.view')
  @ApiOperation({ summary: 'Get an invite'})
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiParam({ name: 'inviteId', description: 'invite id' })
  @ApiResponse({ status: HttpStatus.OK, type: InviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async getInvite(
    @Param('projectId') projectId: string,
    @Param('inviteId') inviteId: string,
    @Query() query: FieldsQueryDto
  ): Promise<InviteResponseDto> {
    return this.service.getInvite(projectId, inviteId, query);
  }

  /**
   * Endpoint for updating an existing project member invitation.
   * @param req - The incoming request object
   * @param projectId - The ID of the associated project
   * @param inviteId - The ID of the invite to update
   * @param dto - Data transfer object containing updated invitation details
   * @returns The updated invitation response
   */
  @Patch('/:projectId/invites/:inviteId')
  @Permission('projectMemberInvite.edit')
  @ApiOperation({ summary: 'Update an invite'})
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiParam({ name: 'inviteId', description: 'invite id' })
  @ApiResponse({ status: HttpStatus.OK, type: InviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async updateInvite(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Param('inviteId') inviteId: string,
    @Body() dto: UpdateInviteDto
  ): Promise<InviteResponseDto> {
    const authUser = req['user'] as JwtUser;
    return this.service.updateInvite(authUser, projectId, inviteId, dto);
  }

  /**
   * Endpoint for deleting a project member invitation.
   * @param projectId - The ID of the associated project
   * @param inviteId - The ID of the invite to delete
   * @returns Nothing upon successful deletion
   */
  @Delete('/:projectId/invites/:inviteId')
  @Permission('projectMemberInvite.delete')
  @ApiOperation({ summary: 'Delete an invite'})
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiParam({ name: 'inviteId', description: 'invite id' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Operation successful' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal Server Error' })
  async deleteInvite(
    @Param('projectId') projectId: string,
    @Param('inviteId') inviteId: string,
  ): Promise<void> {
    await this.service.deleteInvite(projectId, inviteId);
  }
}
