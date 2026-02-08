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
import { TimelineProjectContextGuard } from '../timeline/guards/timeline-project-context.guard';
import { BulkUpdateMilestoneDto } from './dto/bulk-update-milestone.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { MilestoneListQueryDto } from './dto/milestone-list-query.dto';
import { MilestoneResponseDto } from './dto/milestone-response.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { MilestoneService } from './milestone.service';

@ApiTags('Milestones')
@ApiBearerAuth()
@Controller('/timelines/:timelineId/milestones')
export class MilestoneController {
  constructor(private readonly service: MilestoneService) {}

  @Get()
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'List milestones for timeline' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['order asc', 'order desc'],
  })
  @ApiResponse({ status: 200, type: [MilestoneResponseDto] })
  async listMilestones(
    @Param('timelineId') timelineId: string,
    @Query() query: MilestoneListQueryDto,
  ): Promise<MilestoneResponseDto[]> {
    return this.service.listMilestones(timelineId, query);
  }

  @Get(':milestoneId')
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get milestone by id' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone id' })
  @ApiResponse({ status: 200, type: MilestoneResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getMilestone(
    @Param('timelineId') timelineId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<MilestoneResponseDto> {
    return this.service.getMilestone(timelineId, milestoneId);
  }

  @Post()
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Create milestone' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiBody({ type: CreateMilestoneDto })
  @ApiResponse({ status: 201, type: MilestoneResponseDto })
  async createMilestone(
    @Param('timelineId') timelineId: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: JwtUser,
  ): Promise<MilestoneResponseDto> {
    return this.service.createMilestone(timelineId, dto, user);
  }

  @Patch()
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Bulk update milestones' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiBody({ type: [BulkUpdateMilestoneDto] })
  @ApiResponse({ status: 200, type: [MilestoneResponseDto] })
  async bulkUpdateMilestones(
    @Param('timelineId') timelineId: string,
    @Body() dto: BulkUpdateMilestoneDto[],
    @CurrentUser() user: JwtUser,
  ): Promise<MilestoneResponseDto[]> {
    return this.service.bulkUpdateMilestones(timelineId, dto, user);
  }

  @Patch(':milestoneId')
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Update milestone' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone id' })
  @ApiBody({ type: UpdateMilestoneDto })
  @ApiResponse({ status: 200, type: MilestoneResponseDto })
  async updateMilestone(
    @Param('timelineId') timelineId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: JwtUser,
  ): Promise<MilestoneResponseDto> {
    return this.service.updateMilestone(timelineId, milestoneId, dto, user);
  }

  @Delete(':milestoneId')
  @HttpCode(204)
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Delete milestone' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiParam({ name: 'milestoneId', description: 'Milestone id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async deleteMilestone(
    @Param('timelineId') timelineId: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteMilestone(timelineId, milestoneId, user);
  }
}
