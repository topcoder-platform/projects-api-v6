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
export class ProjectPhaseController {
  constructor(private readonly service: ProjectPhaseService) {}

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
