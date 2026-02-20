import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { getAuditUserIdNumber } from '../utils/metadata-utils';
import { CreateProjectTypeDto } from './dto/create-project-type.dto';
import { ProjectTypeResponseDto } from './dto/project-type-response.dto';
import { UpdateProjectTypeDto } from './dto/update-project-type.dto';
import { ProjectTypeService } from './project-type.service';

@ApiTags('Metadata - Project Types')
@ApiBearerAuth()
@Controller('/projects/metadata/projectTypes')
/**
 * REST controller for project type metadata.
 */
export class ProjectTypeController {
  constructor(private readonly projectTypeService: ProjectTypeService) {}

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get()
  @ApiOperation({ summary: 'List project types' })
  @ApiResponse({ status: 200, type: [ProjectTypeResponseDto] })
  /**
   * Lists project types.
   */
  async list(): Promise<ProjectTypeResponseDto[]> {
    return this.projectTypeService.findAll();
  }

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get(':key')
  @ApiOperation({ summary: 'Get project type by key' })
  @ApiParam({ name: 'key', description: 'Project type key' })
  @ApiResponse({ status: 200, type: ProjectTypeResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Gets one project type by key.
   */
  async getOne(@Param('key') key: string): Promise<ProjectTypeResponseDto> {
    return this.projectTypeService.findByKey(key);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create project type' })
  @ApiResponse({ status: 201, type: ProjectTypeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  /**
   * Creates a project type.
   */
  async create(
    @Body() dto: CreateProjectTypeDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectTypeResponseDto> {
    return this.projectTypeService.create(dto, getAuditUserIdNumber(user));
  }

  @Patch(':key')
  @AdminOnly()
  @ApiOperation({ summary: 'Update project type' })
  @ApiParam({ name: 'key', description: 'Project type key' })
  @ApiResponse({ status: 200, type: ProjectTypeResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Updates a project type.
   */
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateProjectTypeDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectTypeResponseDto> {
    return this.projectTypeService.update(key, dto, getAuditUserIdNumber(user));
  }

  @Delete(':key')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete project type (soft delete)' })
  @ApiParam({ name: 'key', description: 'Project type key' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Soft deletes a project type.
   */
  async delete(
    @Param('key') key: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.projectTypeService.delete(key, getAuditUserIdNumber(user));
  }
}
