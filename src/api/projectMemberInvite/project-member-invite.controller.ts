import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
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
  CreateInviteDto,
  CreateInviteResponseDto,
  InviteResponseDto,
  UpdateInviteDto,
} from './project-member-invite.dto';
import { FieldsQueryDto } from '../common/common.dto';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { assign } from 'lodash';
import { ProjectMemberInviteService } from './project-member-invite.service';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { RolesScopesGuard } from 'src/auth/guards/roles-scopes.guard';
import { MANAGER_ROLES, USER_ROLE, M2M_SCOPES } from 'src/shared/constants';

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
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECT_INVITES.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Project member invites' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CreateInviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async createInvite(
    @Req() req: Request,
    @Res({ passthrough: true }) resp: Response,
    @Param('projectId') projectId: number,
    @Body() dto: CreateInviteDto,
    @Query() query: FieldsQueryDto,
  ): Promise<CreateInviteResponseDto> {
    const { success, failed } = await this.service.createInvite(
      projectId,
      dto,
      query,
      req,
    );
    if (failed && failed.length > 0) {
      resp.status(HttpStatus.FORBIDDEN);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return assign({}, success[0], { failed });
    }

    resp.status(HttpStatus.CREATED);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return success[0] as any;
  }

  /**
   * Endpoint for searching project member invitations.
   * Returns all invitations if user has view permission, otherwise only returns user's own invitations.
   * @param projectId - The ID of the project to search invites for
   * @param query - Optional fields query for filtering and response shaping
   * @returns An array of invitation responses
   */
  @Get('/:projectId/invites')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT, USER_ROLE.TOPCODER_USER)
  @Scopes(M2M_SCOPES.PROJECT_INVITES.READ)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'If user can "view" this project, he/she can get all invitations. Otherwise user can only see his/her own invitation in this project. If user has no invitation in this project or this project doesn\'t exist, an empty array will be returned.',
  })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiResponse({
    status: HttpStatus.OK,
    isArray: true,
    type: InviteResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async searchInvite(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Query() query: FieldsQueryDto,
  ): Promise<InviteResponseDto[]> {
    return this.service.searchInvite(projectId, query, req);
  }

  /**
   * Endpoint for retrieving a specific project member invitation.
   * @param projectId - The ID of the associated project
   * @param inviteId - The ID of the invite to retrieve
   * @param query - Optional fields query for response shaping
   * @returns The requested invitation response
   */
  @Get('/:projectId/invites/:inviteId')
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT, USER_ROLE.TOPCODER_USER)
  @Scopes(M2M_SCOPES.PROJECT_INVITES.READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an invite' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiParam({ name: 'inviteId', description: 'invite id' })
  @ApiResponse({ status: HttpStatus.OK, type: InviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async getInvite(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('inviteId') inviteId: number,
    @Query() query: FieldsQueryDto,
  ): Promise<InviteResponseDto> {
    return this.service.getInvite(projectId, inviteId, query, req);
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
  @UseGuards(RolesScopesGuard)
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECT_INVITES.WRITE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an invite' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiParam({ name: 'inviteId', description: 'invite id' })
  @ApiResponse({ status: HttpStatus.OK, type: InviteResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bad Request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Not Found' })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal Server Error',
  })
  async updateInvite(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('inviteId') inviteId: number,
    @Body() dto: UpdateInviteDto,
  ): Promise<InviteResponseDto> {
    return this.service.updateInvite(projectId, inviteId, dto, req);
  }

  /**
   * Endpoint for deleting a project member invitation.
   * @param projectId - The ID of the associated project
   * @param inviteId - The ID of the invite to delete
   * @returns Nothing upon successful deletion
   */
  @Delete('/:projectId/invites/:inviteId')
  @Roles(...MANAGER_ROLES, USER_ROLE.COPILOT)
  @Scopes(M2M_SCOPES.PROJECT_INVITES.WRITE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an invite' })
  @ApiParam({ name: 'projectId', description: 'project id' })
  @ApiParam({ name: 'inviteId', description: 'invite id' })
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
  async deleteInvite(
    @Req() req: Request,
    @Param('projectId') projectId: number,
    @Param('inviteId') inviteId: number,
  ): Promise<void> {
    await this.service.deleteInvite(projectId, inviteId, req);
  }
}
