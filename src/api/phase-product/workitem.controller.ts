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
import { WorkStreamService } from 'src/api/workstream/workstream.service';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CreatePhaseProductDto } from './dto/create-phase-product.dto';
import { PhaseProductResponseDto } from './dto/phase-product-response.dto';
import { UpdatePhaseProductDto } from './dto/update-phase-product.dto';
import { PhaseProductService } from './phase-product.service';

const WORKITEM_ALLOWED_ROLES = [
  UserRole.TOPCODER_ADMIN,
  UserRole.CONNECT_ADMIN,
  UserRole.TG_ADMIN,
  UserRole.MANAGER,
  UserRole.COPILOT,
  UserRole.TC_COPILOT,
  UserRole.COPILOT_MANAGER,
];
// TODO [DRY]: Extract a single `WORK_LAYER_ALLOWED_ROLES` constant to `src/shared/constants/roles.ts`.

@ApiTags('WorkItem')
@ApiBearerAuth()
@Controller(
  '/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems',
)
/**
 * Alias REST controller exposing phase products as "work items" under
 * `/projects/:projectId/workstreams/:workStreamId/works/:workId/workitems`.
 * Used by the platform-ui Work app. Validates work-stream linkage via
 * `WorkStreamService` before delegating to `PhaseProductService`.
 */
export class WorkItemController {
  constructor(
    private readonly phaseProductService: PhaseProductService,
    private readonly workStreamService: WorkStreamService,
  ) {}

  /**
   * Validates work-stream/work linkage, then delegates list retrieval to
   * `PhaseProductService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param workId - Work id (phase id).
   * @param user - Authenticated user.
   * @returns Work item DTO list.
   * @throws {NotFoundException} When the work stream or linkage is missing.
   */
  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...WORKITEM_ALLOWED_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORKITEM_VIEW)
  @ApiOperation({
    summary: 'List work items',
    description:
      'Lists work items inside a work. WorkItem is implemented as a phase product.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'workId', required: true, description: 'Work id' })
  @ApiResponse({ status: 200, type: [PhaseProductResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async listWorkItems(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('workId') workId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto[]> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      workId,
    );

    return this.phaseProductService.listPhaseProducts(projectId, workId, user);
  }

  /**
   * Validates work-stream/work linkage, then delegates single item retrieval to
   * `PhaseProductService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param workId - Work id (phase id).
   * @param id - Work item id (phase product id).
   * @param user - Authenticated user.
   * @returns Work item DTO.
   * @throws {NotFoundException} When the work stream or linkage is missing.
   */
  @Get(':id')
  @UseGuards(PermissionGuard)
  @Roles(...WORKITEM_ALLOWED_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORKITEM_VIEW)
  @ApiOperation({
    summary: 'Get work item',
    description:
      'Returns one work item. WorkItem is implemented as a phase product.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'workId', required: true, description: 'Work id' })
  @ApiParam({ name: 'id', required: true, description: 'Work item id' })
  @ApiResponse({ status: 200, type: PhaseProductResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async getWorkItem(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('workId') workId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      workId,
    );

    return this.phaseProductService.getPhaseProduct(
      projectId,
      workId,
      id,
      user,
    );
  }

  /**
   * Validates work-stream/work linkage, then delegates create to
   * `PhaseProductService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param workId - Work id (phase id).
   * @param dto - Work item create payload.
   * @param user - Authenticated user.
   * @returns Created work item DTO.
   * @throws {NotFoundException} When the work stream or linkage is missing.
   */
  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...WORKITEM_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORKITEM_CREATE)
  @ApiOperation({
    summary: 'Create work item',
    description:
      'Creates a work item under a work. WorkItem is implemented as a phase product.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'workId', required: true, description: 'Work id' })
  @ApiBody({ type: CreatePhaseProductDto })
  @ApiResponse({ status: 201, type: PhaseProductResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async createWorkItem(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('workId') workId: string,
    @Body() dto: CreatePhaseProductDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      workId,
    );

    return this.phaseProductService.createPhaseProduct(
      projectId,
      workId,
      dto,
      user,
    );
  }

  /**
   * Validates work-stream/work linkage, then delegates update to
   * `PhaseProductService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param workId - Work id (phase id).
   * @param id - Work item id (phase product id).
   * @param dto - Work item update payload.
   * @param user - Authenticated user.
   * @returns Updated work item DTO.
   * @throws {NotFoundException} When the work stream or linkage is missing.
   */
  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Roles(...WORKITEM_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORKITEM_EDIT)
  @ApiOperation({
    summary: 'Update work item',
    description:
      'Updates a work item after validating work stream and work linkage.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'workId', required: true, description: 'Work id' })
  @ApiParam({ name: 'id', required: true, description: 'Work item id' })
  @ApiBody({ type: UpdatePhaseProductDto })
  @ApiResponse({ status: 200, type: PhaseProductResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async updateWorkItem(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('workId') workId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePhaseProductDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      workId,
    );

    return this.phaseProductService.updatePhaseProduct(
      projectId,
      workId,
      id,
      dto,
      user,
    );
  }

  /**
   * Validates work-stream/work linkage, then delegates soft delete to
   * `PhaseProductService`.
   *
   * @param projectId - Project id from the route.
   * @param workStreamId - Work stream id from the route.
   * @param workId - Work id (phase id).
   * @param id - Work item id (phase product id).
   * @param user - Authenticated user.
   * @returns Nothing.
   * @throws {NotFoundException} When the work stream or linkage is missing.
   */
  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...WORKITEM_ALLOWED_ROLES)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.WORKITEM_DELETE)
  @ApiOperation({
    summary: 'Delete work item',
    description:
      'Soft deletes a work item after validating work stream and work linkage.',
  })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({
    name: 'workStreamId',
    required: true,
    description: 'Work stream id',
  })
  @ApiParam({ name: 'workId', required: true, description: 'Work id' })
  @ApiParam({ name: 'id', required: true, description: 'Work item id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 500, description: 'Internal Server Error' })
  async deleteWorkItem(
    @Param('projectId') projectId: string,
    @Param('workStreamId') workStreamId: string,
    @Param('workId') workId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.workStreamService.ensurePhaseLinkedToWorkStream(
      projectId,
      workStreamId,
      workId,
    );

    await this.phaseProductService.deletePhaseProduct(
      projectId,
      workId,
      id,
      user,
    );
  }
}
