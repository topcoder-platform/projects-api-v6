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
import { Response } from 'express';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import {
  GetInviteQueryDto,
  InviteListQueryDto,
} from './dto/invite-list-query.dto';
import { InviteBulkResponseDto, InviteDto } from './dto/invite-response.dto';
import { UpdateInviteDto } from './dto/update-invite.dto';
import { ProjectInviteService } from './project-invite.service';

@ApiTags('Project Invites')
@ApiBearerAuth()
@Controller('/projects/:projectId/invites')
export class ProjectInviteController {
  constructor(private readonly service: ProjectInviteService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_INVITES_READ,
    Scope.PROJECT_INVITES_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.READ_PROJECT_INVITE_OWN,
    Permission.READ_PROJECT_INVITE_NOT_OWN,
  )
  @ApiOperation({ summary: 'List project invites' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiResponse({ status: 200, type: [InviteDto] })
  async listInvites(
    @Param('projectId') projectId: string,
    @Query() query: InviteListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown[]> {
    return this.service.listInvites(projectId, query, user);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_INVITES_WRITE,
    Scope.PROJECT_INVITES_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.CREATE_PROJECT_INVITE_CUSTOMER,
    Permission.CREATE_PROJECT_INVITE_TOPCODER,
    Permission.CREATE_PROJECT_INVITE_COPILOT,
  )
  @ApiOperation({ summary: 'Create project invites' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiBody({ type: CreateInviteDto })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiResponse({ status: 201, type: InviteBulkResponseDto })
  @ApiResponse({ status: 403, type: InviteBulkResponseDto })
  async createInvites(
    @Param('projectId') projectId: string,
    @Body() dto: CreateInviteDto,
    @Query('fields') fields: string | undefined,
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InviteBulkResponseDto> {
    const response = await this.service.createInvites(
      projectId,
      dto,
      user,
      fields,
    );

    if (response.failed && response.failed.length > 0) {
      res.status(403);
      return response;
    }

    res.status(201);
    return response;
  }

  @Patch(':inviteId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_INVITES_WRITE,
    Scope.PROJECT_INVITES_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.UPDATE_PROJECT_INVITE_OWN,
    Permission.UPDATE_PROJECT_INVITE_REQUESTED,
    Permission.UPDATE_PROJECT_INVITE_NOT_OWN,
  )
  @ApiOperation({ summary: 'Update project invite' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'inviteId', required: true, description: 'Invite id' })
  @ApiBody({ type: UpdateInviteDto })
  @ApiResponse({ status: 200, type: InviteDto })
  async updateInvite(
    @Param('projectId') projectId: string,
    @Param('inviteId') inviteId: string,
    @Body() dto: UpdateInviteDto,
    @Query('fields') fields: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.updateInvite(projectId, inviteId, dto, user, fields);
  }

  @Delete(':inviteId')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_INVITES_WRITE,
    Scope.PROJECT_INVITES_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.DELETE_PROJECT_INVITE_OWN,
    Permission.DELETE_PROJECT_INVITE_REQUESTED,
    Permission.DELETE_PROJECT_INVITE_NOT_OWN_TOPCODER,
    Permission.DELETE_PROJECT_INVITE_NOT_OWN_CUSTOMER,
    Permission.DELETE_PROJECT_INVITE_NOT_OWN_COPILOT,
  )
  @ApiOperation({ summary: 'Cancel project invite' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'inviteId', required: true, description: 'Invite id' })
  @ApiResponse({ status: 204 })
  async deleteInvite(
    @Param('projectId') projectId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteInvite(projectId, inviteId, user);
  }

  @Get(':inviteId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_INVITES_READ,
    Scope.PROJECT_INVITES_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.READ_PROJECT_INVITE_OWN,
    Permission.READ_PROJECT_INVITE_NOT_OWN,
  )
  @ApiOperation({ summary: 'Get project invite' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'inviteId', required: true, description: 'Invite id' })
  @ApiResponse({ status: 200, type: InviteDto })
  async getInvite(
    @Param('projectId') projectId: string,
    @Param('inviteId') inviteId: string,
    @Query() query: GetInviteQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.getInvite(projectId, inviteId, query, user);
  }
}
