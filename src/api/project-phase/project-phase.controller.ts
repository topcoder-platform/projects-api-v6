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
import { CreatePhaseDto } from './dto/create-phase.dto';
import { PhaseListQueryDto } from './dto/phase-list-query.dto';
import { PhaseResponseDto } from './dto/phase-response.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { ProjectPhaseService } from './project-phase.service';

@ApiTags('Project Phases')
@ApiBearerAuth()
@Controller('/projects/:projectId/phases')
/**
 * REST controller for project phases under `/projects/:projectId/phases`.
 * All endpoints require a valid JWT and are gated by `PermissionGuard`.
 * Read endpoints require `VIEW_PROJECT`; write endpoints require the
 * corresponding `ADD/UPDATE/DELETE_PROJECT_PHASE` permission.
 * Used by platform-ui Work app and the legacy Connect app.
 */
export class ProjectPhaseController {
  constructor(private readonly service: ProjectPhaseService) {}

  /**
   * Lists phases for a project with optional field projection, sorting, and
   * member-only filtering.
   *
   * @param projectId - Project identifier from the route.
   * @param query - Query parameters (`fields`, `sort`, `memberOnly`).
   * @param user - Authenticated JWT user.
   * @returns Array of project phase DTOs.
   * @throws {BadRequestException} When a route id or sort expression is invalid.
   * @throws {ForbiddenException} When the caller lacks project view permission.
   * @throws {NotFoundException} When the project does not exist.
   */
  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'List project phases' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'memberOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [PhaseResponseDto] })
  async listPhases(
    @Param('projectId') projectId: string,
    @Query() query: PhaseListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto[]> {
    return this.service.listPhases(projectId, query, user);
  }

  /**
   * Fetches one phase in a project with its relations.
   *
   * @param projectId - Project identifier from the route.
   * @param phaseId - Phase identifier from the route.
   * @param user - Authenticated JWT user.
   * @returns A single project phase DTO.
   * @throws {BadRequestException} When a route id is invalid.
   * @throws {ForbiddenException} When the caller lacks project view permission.
   * @throws {NotFoundException} When the project or phase is not found.
   */
  @Get(':phaseId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get project phase by id' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiResponse({ status: 200, type: PhaseResponseDto })
  async getPhase(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto> {
    return this.service.getPhase(projectId, phaseId, user);
  }

  /**
   * Creates a new phase in a project.
   *
   * @param projectId - Project identifier from the route.
   * @param dto - Create payload for the phase.
   * @param user - Authenticated JWT user.
   * @returns The created project phase DTO.
   * @throws {BadRequestException} When payload ids, dates, or template data are invalid.
   * @throws {ForbiddenException} When the caller lacks create permission.
   * @throws {NotFoundException} When the project is not found.
   */
  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.ADD_PROJECT_PHASE)
  @ApiOperation({ summary: 'Create project phase' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiBody({ type: CreatePhaseDto })
  @ApiResponse({ status: 201, type: PhaseResponseDto })
  async createPhase(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePhaseDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto> {
    return this.service.createPhase(projectId, dto, user);
  }

  /**
   * Updates an existing project phase.
   *
   * @param projectId - Project identifier from the route.
   * @param phaseId - Phase identifier from the route.
   * @param dto - Partial update payload.
   * @param user - Authenticated JWT user.
   * @returns The updated project phase DTO.
   * @throws {BadRequestException} When ids are invalid or a terminal status transition is requested.
   * @throws {ForbiddenException} When the caller lacks update permission.
   * @throws {NotFoundException} When the project or phase is not found.
   */
  @Patch(':phaseId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.UPDATE_PROJECT_PHASE)
  @ApiOperation({ summary: 'Update project phase' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiBody({ type: UpdatePhaseDto })
  @ApiResponse({ status: 200, type: PhaseResponseDto })
  async updatePhase(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhaseDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto> {
    return this.service.updatePhase(projectId, phaseId, dto, user);
  }

  /**
   * Soft deletes a project phase.
   *
   * @param projectId - Project identifier from the route.
   * @param phaseId - Phase identifier from the route.
   * @param user - Authenticated JWT user.
   * @returns No content.
   * @throws {BadRequestException} When a route id is invalid.
   * @throws {ForbiddenException} When the caller lacks delete permission.
   * @throws {NotFoundException} When the project or phase is not found.
   */
  @Delete(':phaseId')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.DELETE_PROJECT_PHASE)
  @ApiOperation({ summary: 'Delete project phase' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiResponse({ status: 204, description: 'Project phase removed' })
  async deletePhase(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deletePhase(projectId, phaseId, user);
  }
}
