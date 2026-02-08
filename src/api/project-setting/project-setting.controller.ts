import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
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
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { CreateProjectSettingDto } from './dto/create-project-setting.dto';
import { ProjectSettingResponseDto } from './dto/project-setting-response.dto';
import { UpdateProjectSettingDto } from './dto/update-project-setting.dto';
import { ProjectSettingService } from './project-setting.service';

const PROJECT_SETTING_ROLES = Object.values(UserRole);

@ApiTags('Project Settings')
@ApiBearerAuth()
@Controller('/projects/:projectId/settings')
export class ProjectSettingController {
  constructor(
    private readonly service: ProjectSettingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...PROJECT_SETTING_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'List project settings' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiResponse({ status: 200, type: [ProjectSettingResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectSettingResponseDto[]> {
    const projectMembers = await this.getProjectMembers(projectId);
    return this.service.findAll(projectId, user, projectMembers);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...PROJECT_SETTING_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Create project setting' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiBody({ type: CreateProjectSettingDto })
  @ApiResponse({ status: 201, type: ProjectSettingResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectSettingDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectSettingResponseDto> {
    const projectMembers = await this.getProjectMembers(projectId);
    return this.service.create(projectId, dto, user, projectMembers);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Roles(...PROJECT_SETTING_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Update project setting' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Project setting id' })
  @ApiBody({ type: UpdateProjectSettingDto })
  @ApiResponse({ status: 200, type: ProjectSettingResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectSettingDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectSettingResponseDto> {
    const projectMembers = await this.getProjectMembers(projectId);
    return this.service.update(projectId, id, dto, user, projectMembers);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...PROJECT_SETTING_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Delete project setting' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Project setting id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    const projectMembers = await this.getProjectMembers(projectId);
    await this.service.delete(projectId, id, user, projectMembers);
  }

  private async getProjectMembers(projectId: string) {
    const parsedProjectId = this.parseProjectId(projectId);

    return this.prisma.projectMember.findMany({
      where: {
        projectId: parsedProjectId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        isPrimary: true,
        deletedAt: true,
      },
    });
  }

  private parseProjectId(projectId: string): bigint {
    const normalizedProjectId = projectId.trim();

    if (!/^\d+$/.test(normalizedProjectId)) {
      throw new BadRequestException('Project id must be a numeric string.');
    }

    return BigInt(normalizedProjectId);
  }
}
