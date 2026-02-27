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
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CreateMemberDto } from './dto/create-member.dto';
import {
  GetMemberQueryDto,
  MemberListQueryDto,
} from './dto/member-list-query.dto';
import { MemberResponseDto } from './dto/member-response.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ProjectMemberService } from './project-member.service';

@ApiTags('Project Members')
@ApiBearerAuth()
@Controller('/projects/:projectId/members')
/**
 * REST controller for `/projects/:projectId/members`.
 *
 * Every route enforces `PermissionGuard` and delegates business logic to
 * `ProjectMemberService`.
 *
 * Write routes use the scopes `PROJECT_MEMBERS_WRITE`,
 * `PROJECT_MEMBERS_ALL`, and `CONNECT_PROJECT_ADMIN`.
 */
export class ProjectMemberController {
  constructor(private readonly service: ProjectMemberService) {}

  /**
   * Adds a member to the target project.
   *
   * @param projectId Project identifier from the route.
   * @param dto Member creation payload.
   * @param fields Optional CSV list of extra member profile fields to include.
   * @param user Authenticated caller.
   * @returns The created member response payload.
   * @throws {NotFoundException} If the project does not exist.
   * @throws {ForbiddenException} If the caller lacks add-member permissions.
   * @throws {BadRequestException} If ids/role are invalid.
   * @throws {ConflictException} If the target user is already a project member.
   */
  @Post()
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_MEMBERS_WRITE,
    Scope.PROJECT_MEMBERS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.CREATE_PROJECT_MEMBER_OWN,
    Permission.CREATE_PROJECT_MEMBER_NOT_OWN,
  )
  @ApiOperation({ summary: 'Add project member' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiBody({ type: CreateMemberDto })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiResponse({ status: 201, type: MemberResponseDto })
  async addMember(
    @Param('projectId') projectId: string,
    @Body() dto: CreateMemberDto,
    @Query('fields') fields: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.addMember(projectId, dto, user, fields);
  }

  /**
   * Updates an existing project member.
   *
   * @param projectId Project identifier from the route.
   * @param id Project member identifier from the route.
   * @param dto Member update payload.
   * @param fields Optional CSV list of extra member profile fields to include.
   * @param user Authenticated caller.
   * @returns The updated member response payload.
   * @throws {NotFoundException} If the project or member does not exist.
   * @throws {ForbiddenException} If the caller lacks update permissions.
   * @throws {BadRequestException} If ids are invalid.
   * @throws {ConflictException} If an update conflicts with existing state.
   */
  @Patch(':id')
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_MEMBERS_WRITE,
    Scope.PROJECT_MEMBERS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.UPDATE_PROJECT_MEMBER_NON_CUSTOMER,
    Permission.CREATE_PROJECT_MEMBER_OWN,
  )
  @ApiOperation({ summary: 'Update project member' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Project member id' })
  @ApiBody({ type: UpdateMemberDto })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async updateMember(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @Query('fields') fields: string | undefined,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.updateMember(projectId, id, dto, user, fields);
  }

  /**
   * Soft-deletes a project member.
   *
   * @param projectId Project identifier from the route.
   * @param id Project member identifier from the route.
   * @param user Authenticated caller.
   * @returns Resolves when deletion completes.
   * @throws {NotFoundException} If the project or member does not exist.
   * @throws {ForbiddenException} If the caller lacks delete permissions.
   * @throws {BadRequestException} If ids are invalid.
   * @throws {ConflictException} If deletion conflicts with current state.
   */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_MEMBERS_WRITE,
    Scope.PROJECT_MEMBERS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(
    Permission.DELETE_PROJECT_MEMBER_TOPCODER,
    Permission.DELETE_PROJECT_MEMBER_CUSTOMER,
    Permission.DELETE_PROJECT_MEMBER_COPILOT,
  )
  @ApiOperation({ summary: 'Remove project member' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Project member id' })
  @ApiResponse({ status: 204 })
  async deleteMember(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteMember(projectId, id, user);
  }

  /**
   * Lists members for a project.
   *
   * @param projectId Project identifier from the route.
   * @param query Optional list filters and response field selection.
   * @param user Authenticated caller.
   * @returns A list of serialized member response payloads.
   * @throws {NotFoundException} If the project does not exist.
   * @throws {ForbiddenException} If the caller lacks read permissions.
   * @throws {BadRequestException} If ids are invalid.
   * @throws {ConflictException} If query execution conflicts with current state.
   */
  @Get()
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_MEMBERS_READ,
    Scope.PROJECT_MEMBERS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.READ_PROJECT_MEMBER)
  @ApiOperation({ summary: 'List project members' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiResponse({ status: 200, type: [MemberResponseDto] })
  async listMembers(
    @Param('projectId') projectId: string,
    @Query() query: MemberListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown[]> {
    return this.service.listMembers(projectId, query, user);
  }

  /**
   * Gets a single member by id.
   *
   * @param projectId Project identifier from the route.
   * @param id Project member identifier from the route.
   * @param query Optional response field selection.
   * @param user Authenticated caller.
   * @returns The serialized member response payload.
   * @throws {NotFoundException} If the project or member does not exist.
   * @throws {ForbiddenException} If the caller lacks read permissions.
   * @throws {BadRequestException} If ids are invalid.
   * @throws {ConflictException} If retrieval conflicts with current state.
   */
  @Get(':id')
  @UseGuards(PermissionGuard)
  // TODO: QUALITY: `@Roles(...Object.values(UserRole))` repeats on every route;
  // extract to a controller-level decorator or shared constant.
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECT_MEMBERS_READ,
    Scope.PROJECT_MEMBERS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.READ_PROJECT_MEMBER)
  @ApiOperation({ summary: 'Get project member' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Project member id' })
  @ApiResponse({ status: 200, type: MemberResponseDto })
  async getMember(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query() query: GetMemberQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.getMember(projectId, id, query, user);
  }
}
