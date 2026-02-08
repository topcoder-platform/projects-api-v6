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
import { AttachmentListQueryDto } from './dto/attachment-list-query.dto';
import { AttachmentResponseDto } from './dto/attachment-response.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { ProjectAttachmentService } from './project-attachment.service';

@ApiTags('Project Attachments')
@ApiBearerAuth()
@Controller('/projects/:projectId/attachments')
export class ProjectAttachmentController {
  constructor(private readonly service: ProjectAttachmentService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT_ATTACHMENT)
  @ApiOperation({ summary: 'List project attachments' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiResponse({ status: 200, type: [AttachmentResponseDto] })
  async listAttachments(
    @Param('projectId') projectId: string,
    @Query() _query: AttachmentListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<AttachmentResponseDto[]> {
    return this.service.listAttachments(projectId, user);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT_ATTACHMENT)
  @ApiOperation({ summary: 'Get project attachment by id' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Attachment id' })
  @ApiResponse({ status: 200, type: AttachmentResponseDto })
  async getAttachment(
    @Param('projectId') projectId: string,
    @Param('id') attachmentId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<AttachmentResponseDto> {
    return this.service.getAttachment(projectId, attachmentId, user);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.CREATE_PROJECT_ATTACHMENT)
  @ApiOperation({ summary: 'Create project attachment' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiBody({ type: CreateAttachmentDto })
  @ApiResponse({ status: 201, type: AttachmentResponseDto })
  async createAttachment(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAttachmentDto,
    @CurrentUser() user: JwtUser,
  ): Promise<AttachmentResponseDto> {
    return this.service.createAttachment(projectId, dto, user);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.EDIT_PROJECT_ATTACHMENT)
  @ApiOperation({ summary: 'Update project attachment' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Attachment id' })
  @ApiBody({ type: UpdateAttachmentDto })
  @ApiResponse({ status: 200, type: AttachmentResponseDto })
  async updateAttachment(
    @Param('projectId') projectId: string,
    @Param('id') attachmentId: string,
    @Body() dto: UpdateAttachmentDto,
    @CurrentUser() user: JwtUser,
  ): Promise<AttachmentResponseDto> {
    return this.service.updateAttachment(projectId, attachmentId, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.DELETE_PROJECT_ATTACHMENT)
  @ApiOperation({ summary: 'Delete project attachment' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Attachment id' })
  @ApiResponse({ status: 204, description: 'Attachment removed' })
  async deleteAttachment(
    @Param('projectId') projectId: string,
    @Param('id') attachmentId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deleteAttachment(projectId, attachmentId, user);
  }
}
