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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { Public } from 'src/shared/decorators/public.decorator';
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import {
  getAuditUserIdBigInt,
  parseOptionalBooleanQuery,
} from '../utils/metadata-utils';
import { CreateProjectTemplateDto } from './dto/create-project-template.dto';
import { ProjectTemplateResponseDto } from './dto/project-template-response.dto';
import { UpdateProjectTemplateDto } from './dto/update-project-template.dto';
import { UpgradeProjectTemplateDto } from './dto/upgrade-project-template.dto';
import { ProjectTemplateService } from './project-template.service';

@ApiTags('Metadata - Project Templates')
@ApiBearerAuth()
@Controller('/projects/metadata/projectTemplates')
/**
 * REST controller for project template metadata.
 *
 * Read endpoints are public (`@Public()`); write endpoints require
 * `@AdminOnly`.
 */
export class ProjectTemplateController {
  constructor(
    private readonly projectTemplateService: ProjectTemplateService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List project templates',
    description:
      'Returns project templates. Disabled templates are excluded by default.',
  })
  @ApiQuery({
    name: 'includeDisabled',
    required: false,
    type: Boolean,
    description: 'Include disabled templates when true.',
  })
  @ApiResponse({ status: 200, type: [ProjectTemplateResponseDto] })
  /**
   * Lists project templates.
   */
  async list(
    @Query('includeDisabled') includeDisabled?: string,
  ): Promise<ProjectTemplateResponseDto[]> {
    return this.projectTemplateService.findAll(
      parseOptionalBooleanQuery(includeDisabled) || false,
    );
  }

  @Public()
  @Get(':templateId')
  @ApiOperation({ summary: 'Get project template by id' })
  @ApiParam({ name: 'templateId', description: 'Project template id' })
  @ApiResponse({ status: 200, type: ProjectTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Gets one project template by id.
   */
  async getOne(
    @Param('templateId') templateId: string,
  ): Promise<ProjectTemplateResponseDto> {
    return this.projectTemplateService.findOne(
      this.projectTemplateService.parseTemplateId(templateId),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create project template' })
  @ApiResponse({ status: 201, type: ProjectTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  /**
   * Creates a project template.
   */
  async create(
    @Body() dto: CreateProjectTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectTemplateResponseDto> {
    return this.projectTemplateService.create(dto, getAuditUserIdBigInt(user));
  }

  @Patch(':templateId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update project template' })
  @ApiParam({ name: 'templateId', description: 'Project template id' })
  @ApiResponse({ status: 200, type: ProjectTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Updates a project template by id.
   */
  async update(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateProjectTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectTemplateResponseDto> {
    return this.projectTemplateService.update(
      this.projectTemplateService.parseTemplateId(templateId),
      dto,
      getAuditUserIdBigInt(user),
    );
  }

  @Delete(':templateId')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete project template (soft delete)' })
  @ApiParam({ name: 'templateId', description: 'Project template id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Soft deletes a project template.
   */
  async delete(
    @Param('templateId') templateId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.projectTemplateService.delete(
      this.projectTemplateService.parseTemplateId(templateId),
      getAuditUserIdBigInt(user),
    );
  }

  @Post(':templateId/upgrade')
  @AdminOnly()
  @ApiOperation({ summary: 'Upgrade project template version references' })
  @ApiParam({ name: 'templateId', description: 'Project template id' })
  @ApiResponse({ status: 201, type: ProjectTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Upgrades legacy project template configuration to versioned references.
   */
  async upgrade(
    @Param('templateId') templateId: string,
    @Body() dto: UpgradeProjectTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectTemplateResponseDto> {
    return this.projectTemplateService.upgrade(
      this.projectTemplateService.parseTemplateId(templateId),
      dto,
      getAuditUserIdBigInt(user),
    );
  }
}
