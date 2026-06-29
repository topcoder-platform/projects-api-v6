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
import { getAuditUserIdNumber } from 'src/api/metadata/utils/metadata-utils';
import { CreateProjectPostIndustryDto } from './dto/create-project-post-industry.dto';
import { ProjectPostIndustryResponseDto } from './dto/project-post-industry-response.dto';
import { UpdateProjectPostIndustryDto } from './dto/update-project-post-industry.dto';
import { ProjectPostIndustryService } from './project-post-industry.service';

@ApiTags('Project Showcase Post Industries')
@ApiBearerAuth()
@AnyAuthenticated()
@Controller('/projects/posts/industries')
export class ProjectPostIndustryController {
  constructor(private readonly service: ProjectPostIndustryService) {}

  @Get()
  @ApiOperation({ summary: 'List project showcase post industries' })
  @ApiResponse({ status: 200, type: [ProjectPostIndustryResponseDto] })
  async list(): Promise<ProjectPostIndustryResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project showcase post industry by id' })
  @ApiParam({ name: 'id', description: 'Industry id' })
  @ApiResponse({ status: 200, type: ProjectPostIndustryResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOne(
    @Param('id') id: string,
  ): Promise<ProjectPostIndustryResponseDto> {
    return this.service.findById(id);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create project showcase post industry' })
  @ApiResponse({ status: 201, type: ProjectPostIndustryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateProjectPostIndustryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectPostIndustryResponseDto> {
    return this.service.create(dto, getAuditUserIdNumber(user));
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update project showcase post industry' })
  @ApiParam({ name: 'id', description: 'Industry id' })
  @ApiResponse({ status: 200, type: ProjectPostIndustryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectPostIndustryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectPostIndustryResponseDto> {
    return this.service.update(id, dto, getAuditUserIdNumber(user));
  }

  @Delete(':id')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete project showcase post industry' })
  @ApiParam({ name: 'id', description: 'Industry id' })
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
