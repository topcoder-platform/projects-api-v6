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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { setProjectPaginationHeaders } from 'src/shared/utils/pagination.utils';
import { ProjectShowcasePostResponseDto } from './dto/project-showcase-post-response.dto';
import { ProjectShowcasePostListQueryDto } from './dto/project-showcase-post-list-query.dto';
import { CreateProjectShowcasePostDto } from './dto/create-project-showcase-post.dto';
import { UpdateProjectShowcasePostDto } from './dto/update-project-showcase-post.dto';
import { ProjectShowcasePostService } from './project-showcase-post.service';

@ApiTags('Project Showcase Posts')
@ApiBearerAuth()
@Controller('/projects')
export class ProjectShowcasePostController {
  constructor(private readonly service: ProjectShowcasePostService) {}

  @Get('posts')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_READ, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.READ_PROJECT_ANY)
  @ApiOperation({ summary: 'Search project showcase posts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({
    name: 'industryId',
    required: false,
    type: String,
    isArray: true,
    example: ['1', '2'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    isArray: true,
    example: ['2', '3'],
  })
  @ApiQuery({ name: 'challengeId', required: false, type: String })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated showcase posts list',
    type: [ProjectShowcasePostResponseDto],
  })
  async searchPosts(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ProjectShowcasePostListQueryDto,
  ): Promise<ProjectShowcasePostResponseDto[]> {
    const posts = await this.service.listPosts(query)
    const total = await this.service.countPosts(query)

    setProjectPaginationHeaders(
      req,
      res,
      query.page || 1,
      query.perPage || 20,
      total,
    )

    return posts;
  }

  @Get(':projectId/posts')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'List showcase posts for a project' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({
    name: 'industryId',
    required: false,
    type: String,
    isArray: true,
    example: ['5', '10'],
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    isArray: true,
    example: ['7', '12'],
  })
  @ApiQuery({ name: 'challengeId', required: false, type: String })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Project showcase posts list',
    type: [ProjectShowcasePostResponseDto],
  })
  async listProjectPosts(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('projectId') projectId: string,
    @Query() query: ProjectShowcasePostListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto[]> {
    const posts = await this.service.listProjectPosts(projectId, query, user)
    const total = await this.service.countProjectPosts(projectId, query, user)

    setProjectPaginationHeaders(
      req,
      res,
      query.page || 1,
      query.perPage || 20,
      total,
    )

    return posts;
  }

  @Get(':projectId/posts/:id')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get a project showcase post' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Showcase post id' })
  @ApiResponse({ status: 200, type: ProjectShowcasePostResponseDto })
  async getProjectPost(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto> {
    return this.service.getPost(projectId, id, user);
  }

  @Post(':projectId/posts')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.MANAGE_PROJECT_SHOWCASE_POST)
  @ApiOperation({ summary: 'Create a project showcase post' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiResponse({ status: 201, type: ProjectShowcasePostResponseDto })
  async createProjectPost(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectShowcasePostDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto> {
    return this.service.createPost(projectId, dto, user);
  }

  @Patch(':projectId/posts/:id')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.MANAGE_PROJECT_SHOWCASE_POST)
  @ApiOperation({ summary: 'Update a project showcase post' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Showcase post id' })
  @ApiResponse({ status: 200, type: ProjectShowcasePostResponseDto })
  async updateProjectPost(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectShowcasePostDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProjectShowcasePostResponseDto> {
    return this.service.updatePost(projectId, id, dto, user);
  }

  @Delete(':projectId/posts/:id')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.MANAGE_PROJECT_SHOWCASE_POST)
  @ApiOperation({ summary: 'Delete a project showcase post' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'id', required: true, description: 'Showcase post id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  async deleteProjectPost(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deletePost(projectId, id, user);
  }
}
