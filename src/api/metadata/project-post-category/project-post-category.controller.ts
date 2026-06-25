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
import { AnyAuthenticated } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { getAuditUserIdNumber } from '../utils/metadata-utils';
import { CreateProjectPostCategoryDto } from './dto/create-project-post-category.dto';
import { ProjectPostCategoryResponseDto } from './dto/project-post-category-response.dto';
import { UpdateProjectPostCategoryDto } from './dto/update-project-post-category.dto';
import { ProjectPostCategoryService } from './project-post-category.service';

@ApiTags('Metadata - Project Post Categories')
@ApiBearerAuth()
@AnyAuthenticated()
@Controller('/projects/metadata/projectPostCategories')
export class ProjectPostCategoryController {
  constructor(
    private readonly service: ProjectPostCategoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List project showcase post categories' })
  @ApiResponse({ status: 200, type: [ProjectPostCategoryResponseDto] })
  async list(): Promise<ProjectPostCategoryResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project showcase post category by id' })
  @ApiParam({ name: 'id', description: 'Category id' })
  @ApiResponse({ status: 200, type: ProjectPostCategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOne(
    @Param('id') id: string,
  ): Promise<ProjectPostCategoryResponseDto> {
    return this.service.findById(id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create project showcase post category' })
  @ApiResponse({ status: 201, type: ProjectPostCategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateProjectPostCategoryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectPostCategoryResponseDto> {
    return this.service.create(dto, getAuditUserIdNumber(user));
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update project showcase post category' })
  @ApiParam({ name: 'id', description: 'Category id' })
  @ApiResponse({ status: 200, type: ProjectPostCategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectPostCategoryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectPostCategoryResponseDto> {
    return this.service.update(id, dto, getAuditUserIdNumber(user));
  }

  @Delete(':id')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete project showcase post category (soft delete)' })
  @ApiParam({ name: 'id', description: 'Category id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.delete(id, getAuditUserIdNumber(user));
  }
}
