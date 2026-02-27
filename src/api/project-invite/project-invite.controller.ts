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
/**
 * REST controller for `/projects/:projectId/invites`.
 *
 * `createInvites` can return HTTP 403 for partial failures while still
 * returning successful records in `InviteBulkResponseDto`.
 *
 * `deleteInvite` performs a soft cancel by setting `status = canceled`.
 */
export class ProjectInviteController {
  constructor(private readonly service: ProjectInviteService) {}

  /**
   * Lists invites for a project.
   *
   * @param projectId Project identifier from the route.
   * @param query Optional list query fields.
   * @param user Authenticated caller.
   * @returns A list of invite response payloads.
   * @throws {NotFoundException} If the project does not exist.
   * @throws {ForbiddenException} If invite read permissions are missing.
   * @throws {BadRequestException} If ids are invalid.
   */
  @Get()
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
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

  /**
   * Creates invites by handles/emails with partial-failure semantics.
   *
   * Full success returns HTTP 201. Partial success returns HTTP 403 with both
   * `success` and `failed` payload sections.
   *
   * @param projectId Project identifier from the route.
   * @param dto Invite creation payload.
   * @param fields Optional CSV list of additional user fields in the response.
   * @param user Authenticated caller.
   * @param res Express response used to set status code.
   * @returns Bulk invite response with success and optional failures.
   * @throws {NotFoundException} If the project does not exist.
   * @throws {ForbiddenException} If create permissions are missing.
   * @throws {BadRequestException} If request payload is invalid.
   */
  @Post()
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
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

  /**
   * Updates an invite status.
   *
   * @param projectId Project identifier from the route.
   * @param inviteId Invite identifier from the route.
   * @param dto Invite update payload.
   * @param fields Optional CSV list of additional user fields in the response.
   * @param user Authenticated caller.
   * @returns Updated invite payload.
   * @throws {NotFoundException} If the project or invite does not exist.
   * @throws {ForbiddenException} If update permissions are missing.
   * @throws {BadRequestException} If ids/status payload is invalid.
   * @throws {ConflictException} If linked copilot opportunity is inactive.
   */
  @Patch(':inviteId')
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
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

  /**
   * Cancels an invite by setting its status to `canceled`.
   *
   * @param projectId Project identifier from the route.
   * @param inviteId Invite identifier from the route.
   * @param user Authenticated caller.
   * @returns Resolves when cancellation is complete.
   * @throws {NotFoundException} If the project or invite does not exist.
   * @throws {ForbiddenException} If delete permissions are missing.
   * @throws {BadRequestException} If ids are invalid.
   */
  @Delete(':inviteId')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
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

  /**
   * Gets a single invite by id.
   *
   * @param projectId Project identifier from the route.
   * @param inviteId Invite identifier from the route.
   * @param query Optional response field selection.
   * @param user Authenticated caller.
   * @returns Invite response payload.
   * @throws {NotFoundException} If the project or invite does not exist.
   * @throws {ForbiddenException} If read permissions are missing.
   * @throws {BadRequestException} If ids are invalid.
   */
  @Get(':inviteId')
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
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
