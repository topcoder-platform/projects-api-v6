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
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { TimelineListQueryDto } from './dto/timeline-list-query.dto';
import { TimelineResponseDto } from './dto/timeline-response.dto';
import { UpdateTimelineDto } from './dto/update-timeline.dto';
import { TimelineProjectContextGuard } from './guards/timeline-project-context.guard';
import { TimelineService } from './timeline.service';

@ApiTags('Timelines')
@ApiBearerAuth()
@Controller('/timelines')
export class TimelineController {
  constructor(private readonly service: TimelineService) {}

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
  @ApiOperation({ summary: 'List timelines by reference and referenceId' })
  @ApiQuery({ name: 'reference', required: true })
  @ApiQuery({ name: 'referenceId', required: true, type: Number })
  @ApiResponse({ status: 200, type: [TimelineResponseDto] })
  async listTimelines(
    @Query() query: TimelineListQueryDto,
  ): Promise<TimelineResponseDto[]> {
    return this.service.listTimelines(query);
  }

  @Get(':timelineId')
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get timeline by id' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiResponse({ status: 200, type: TimelineResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getTimeline(
    @Param('timelineId') timelineId: string,
  ): Promise<TimelineResponseDto> {
    return this.service.getTimeline(timelineId);
  }

  @Post()
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Create timeline' })
  @ApiBody({ type: CreateTimelineDto })
  @ApiResponse({ status: 201, type: TimelineResponseDto })
  async createTimeline(
    @Body() dto: CreateTimelineDto,
    @CurrentUser() user: JwtUser,
  ): Promise<TimelineResponseDto> {
    return this.service.createTimeline(dto, user);
  }

  @Patch(':timelineId')
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Update timeline' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiBody({ type: UpdateTimelineDto })
  @ApiResponse({ status: 200, type: TimelineResponseDto })
  async updateTimeline(
    @Param('timelineId') timelineId: string,
    @Body() dto: UpdateTimelineDto,
    @CurrentUser() user: JwtUser,
  ): Promise<TimelineResponseDto> {
    return this.service.updateTimeline(timelineId, dto, user);
  }

  @Delete(':timelineId')
  @HttpCode(204)
  @UseGuards(TimelineProjectContextGuard, PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT)
  @ApiOperation({ summary: 'Delete timeline' })
  @ApiParam({ name: 'timelineId', description: 'Timeline id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async deleteTimeline(
    @Param('timelineId') timelineId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteTimeline(timelineId, user);
  }
}
