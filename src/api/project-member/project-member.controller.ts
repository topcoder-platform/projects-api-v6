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
export class ProjectMemberController {
  constructor(private readonly service: ProjectMemberService) {}

  @Post()
  @UseGuards(PermissionGuard)
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

  @Patch(':id')
  @UseGuards(PermissionGuard)
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

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
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

  @Get()
  @UseGuards(PermissionGuard)
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

  @Get(':id')
  @UseGuards(PermissionGuard)
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
