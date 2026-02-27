import {
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
import { parseNumericStringId } from 'src/shared/utils/service.utils';
import { CreateProjectSettingDto } from './dto/create-project-setting.dto';
import { ProjectSettingResponseDto } from './dto/project-setting-response.dto';
import { UpdateProjectSettingDto } from './dto/update-project-setting.dto';
import { ProjectSettingService } from './project-setting.service';

const PROJECT_SETTING_ROLES = Object.values(UserRole);

@ApiTags('Project Settings')
@ApiBearerAuth()
@Controller('/projects/:projectId/settings')
/**
 * REST controller for `/projects/:projectId/settings`.
 *
 * Settings are per-project key/value records with per-record
 * `readPermission` and `writePermission` JSON objects. Visibility filtering is
 * enforced by the service layer.
 *
 * Architectural note: this controller currently injects `PrismaService` and
 * preloads project members for each route, which couples controller logic to
 * persistence concerns.
 */
export class ProjectSettingController {
  constructor(
    private readonly service: ProjectSettingService,
    // TODO: QUALITY: Controller-level Prisma usage couples HTTP handling to data
    // access. Move member lookup into `ProjectSettingService`.
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Lists project settings visible to the current user.
   *
   * @param projectId Project identifier from route params.
   * @param user Authenticated caller.
   * @returns List of project setting response DTOs.
   * @throws {BadRequestException} If project id is not numeric.
   * @throws {ForbiddenException} If read permission check fails.
   * @throws {NotFoundException} If project does not exist.
   */
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
    // TODO: QUALITY: This performs a separate member query per route before
    // service execution. Consolidate project/member lookup in the service to
    // reduce round-trips.
    const projectMembers = await this.getProjectMembers(projectId);
    return this.service.findAll(projectId, user, projectMembers);
  }

  /**
   * Creates a project setting.
   *
   * @param projectId Project identifier from route params.
   * @param dto Project setting payload.
   * @param user Authenticated caller.
   * @returns Created project setting response DTO.
   * @throws {BadRequestException} If project id or payload is invalid.
   * @throws {ForbiddenException} If write permission check fails.
   * @throws {NotFoundException} If project does not exist.
   * @throws {ConflictException} If the setting key already exists.
   */
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
    // TODO: QUALITY: This performs a separate member query per route before
    // service execution. Consolidate project/member lookup in the service to
    // reduce round-trips.
    const projectMembers = await this.getProjectMembers(projectId);
    return this.service.create(projectId, dto, user, projectMembers);
  }

  /**
   * Updates a project setting.
   *
   * @param projectId Project identifier from route params.
   * @param id Project setting identifier from route params.
   * @param dto Partial project setting payload.
   * @param user Authenticated caller.
   * @returns Updated project setting response DTO.
   * @throws {BadRequestException} If ids or payload are invalid.
   * @throws {ForbiddenException} If write permission check fails.
   * @throws {NotFoundException} If setting/project does not exist.
   * @throws {ConflictException} If updated key conflicts.
   */
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
    // TODO: QUALITY: This performs a separate member query per route before
    // service execution. Consolidate project/member lookup in the service to
    // reduce round-trips.
    const projectMembers = await this.getProjectMembers(projectId);
    return this.service.update(projectId, id, dto, user, projectMembers);
  }

  /**
   * Soft-deletes a project setting.
   *
   * @param projectId Project identifier from route params.
   * @param id Project setting identifier from route params.
   * @param user Authenticated caller.
   * @returns Resolves when deletion is complete.
   * @throws {BadRequestException} If ids are invalid.
   * @throws {ForbiddenException} If write permission check fails.
   * @throws {NotFoundException} If setting/project does not exist.
   */
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
    // TODO: QUALITY: This performs a separate member query per route before
    // service execution. Consolidate project/member lookup in the service to
    // reduce round-trips.
    const projectMembers = await this.getProjectMembers(projectId);
    await this.service.delete(projectId, id, user, projectMembers);
  }

  /**
   * Fetches active project members for downstream permission checks.
   *
   * @param projectId Project identifier from route params.
   * @returns Project member records with fields required by permission checks.
   * @throws {BadRequestException} If project id is not numeric.
   */
  // TODO: QUALITY: Move this method to `ProjectSettingService` so the
  // controller no longer accesses Prisma directly.
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

  /**
   * Parses and validates numeric project id params.
   *
   * @param projectId Raw project id route param.
   * @returns Parsed bigint project id.
   * @throws {BadRequestException} If project id is not numeric.
   */
  private parseProjectId(projectId: string): bigint {
    return parseNumericStringId(projectId, 'Project id');
  }
}
