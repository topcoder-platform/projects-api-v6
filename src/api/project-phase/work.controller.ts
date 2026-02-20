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
import { WorkStreamService } from 'src/api/workstream/workstream.service';
import { Permission } from 'src/shared/constants/permissions';
import { WORK_LAYER_ALLOWED_ROLES } from 'src/shared/constants/roles';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { PhaseListQueryDto } from './dto/phase-list-query.dto';
import { PhaseResponseDto } from './dto/phase-response.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { ProjectPhaseService } from './project-phase.service';

@ApiTags('Work')
@ApiBearerAuth()
@Controller('/projects/:projectId/workstreams/:workStreamId/works')
/**
 * Alias REST controller exposing project phases as "works" under
 * `/projects/:projectId/workstreams/:workStreamId/works`. Used by the
 * platform-ui Work app. Delegates all business logic to `ProjectPhaseService`;
 * uses `WorkStreamService` to validate work-stream membership before each
 * operation.
 */
export class WorkController {
  constructor(
    private readonly projectPhaseService: ProjectPhaseService,
    private readonly workStreamService: WorkStreamService,
  ) {}

  /**
   * Validates the work stream exists, resolves linked phase ids, then delegates
   * phase listing to `ProjectPhaseService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param query - Work list query parameters.
   * @param user - Authenticated user.
   * @returns Array of work DTOs.
   * @throws {NotFoundException} When work stream is missing.
   */
  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORK_VIEW)
  @ApiOperation({
    summary: 'List works',
    description:
      'Lists works inside a work stream. Work is implemented as a project phase linked through phase_work_streams.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiQuery({ name: 'fields', required: false, type: String })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'memberOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [PhaseResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async listWorks(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Query() query: PhaseListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto[]> {
    await this.workStreamService.ensureWorkStreamExists(
      projectId,
      workStreamId,
    );
    const linkedPhaseIds = await this.workStreamService.listLinkedPhaseIds(
      projectId,
      workStreamId,
    );

    if (linkedPhaseIds.length === 0) {
      return [];
    }

    return this.projectPhaseService.listPhases(projectId, query, user, {
      phaseIds: linkedPhaseIds,
    });
  }

  /**
   * Validates work-stream linkage for the phase id, then delegates retrieval to
   * `ProjectPhaseService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param id - Work id (phase id).
   * @param user - Authenticated user.
   * @returns One work DTO.
   * @throws {NotFoundException} When work stream is missing or work is not linked.
   */
  @Get(':id')
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORK_VIEW)
  @ApiOperation({
    summary: 'Get work',
    description:
      'Returns one work by id. Work is implemented as a project phase linked to the work stream.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'id', required: true, description: 'Work id' })
  @ApiResponse({ status: 200, type: PhaseResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getWork(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      id,
    );

    return this.projectPhaseService.getPhase(projectId, id, user);
  }

  /**
   * Validates the work stream, creates a phase as a work, then creates a
   * `phase_work_streams` link via `WorkStreamService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param dto - Work create payload.
   * @param user - Authenticated user.
   * @returns Created work DTO.
   * @throws {NotFoundException} When the work stream does not exist.
   */
  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORK_CREATE)
  @ApiOperation({
    summary: 'Create work',
    description:
      'Creates a work (project phase) and links it to the work stream via phase_work_streams.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiBody({ type: CreatePhaseDto })
  @ApiResponse({ status: 201, type: PhaseResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async createWork(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Body() dto: CreatePhaseDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto> {
    await this.workStreamService.ensureWorkStreamExists(
      projectId,
      workStreamId,
    );
    const created = await this.projectPhaseService.createPhase(
      projectId,
      dto,
      user,
    );

    await this.workStreamService.createLink(workStreamId, created.id);

    return created;
  }

  /**
   * Validates that the work belongs to the work stream, then delegates update
   * to `ProjectPhaseService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param id - Work id (phase id).
   * @param dto - Work update payload.
   * @param user - Authenticated user.
   * @returns Updated work DTO.
   * @throws {NotFoundException} When work stream is missing or work is not linked.
   */
  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORK_EDIT)
  @ApiOperation({
    summary: 'Update work',
    description:
      'Updates a work (project phase) after validating the work stream linkage.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'id', required: true, description: 'Work id' })
  @ApiBody({ type: UpdatePhaseDto })
  @ApiResponse({ status: 200, type: PhaseResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async updateWork(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePhaseDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseResponseDto> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      id,
    );

    return this.projectPhaseService.updatePhase(projectId, id, dto, user);
  }

  /**
   * Validates work-stream linkage, then delegates soft deletion to
   * `ProjectPhaseService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param id - Work id (phase id).
   * @param user - Authenticated user.
   * @returns Nothing.
   * @throws {NotFoundException} When work stream is missing or work is not linked.
   */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...WORK_LAYER_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORK_DELETE)
  @ApiOperation({
    summary: 'Delete work',
    description:
      'Soft deletes a work (project phase) after validating work stream linkage.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'id', required: true, description: 'Work id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async deleteWork(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      id,
    );
    await this.projectPhaseService.deletePhase(projectId, id, user);
  }
}
