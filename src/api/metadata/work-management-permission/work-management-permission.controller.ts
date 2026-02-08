import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
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
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { getAuditUserIdNumber } from '../utils/metadata-utils';
import { CreateWorkManagementPermissionDto } from './dto/create-work-management-permission.dto';
import { UpdateWorkManagementPermissionRequestDto } from './dto/update-work-management-permission-request.dto';
import { UpdateWorkManagementPermissionDto } from './dto/update-work-management-permission.dto';
import { WorkManagementPermissionCriteriaDto } from './dto/work-management-permission-criteria.dto';
import { WorkManagementPermissionIdQueryDto } from './dto/work-management-permission-id-query.dto';
import { WorkManagementPermissionQueryDto } from './dto/work-management-permission-query.dto';
import { WorkManagementPermissionResponseDto } from './dto/work-management-permission-response.dto';
import { WorkManagementPermissionService } from './work-management-permission.service';

const WORK_MANAGEMENT_PERMISSION_ROLES = Object.values(UserRole);

@ApiTags('Metadata - Work Management Permission')
@ApiBearerAuth()
@Controller('/projects/metadata/workManagementPermission')
export class WorkManagementPermissionController {
  constructor(
    private readonly workManagementPermissionService: WorkManagementPermissionService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_MANAGEMENT_PERMISSION_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORK_MANAGEMENT_PERMISSION_VIEW)
  @ApiOperation({
    summary: 'List or get work management permissions',
    description:
      'Provide id to fetch a single permission; otherwise provide projectTemplateId to list permissions.',
  })
  @ApiQuery({
    name: 'id',
    required: false,
    type: Number,
    description: 'Get a single work management permission by id.',
  })
  @ApiQuery({
    name: 'projectTemplateId',
    required: false,
    type: Number,
    description: 'Filter permissions by project template id.',
  })
  @ApiResponse({ status: 200, type: [WorkManagementPermissionResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 200, type: WorkManagementPermissionResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listOrGet(
    @Query() query: WorkManagementPermissionQueryDto,
  ): Promise<
    WorkManagementPermissionResponseDto[] | WorkManagementPermissionResponseDto
  > {
    if (typeof query.id === 'number') {
      return this.workManagementPermissionService.findOne(
        this.workManagementPermissionService.parseId(query.id.toString()),
      );
    }

    if (typeof query.projectTemplateId !== 'number') {
      throw new BadRequestException(
        'Either id or projectTemplateId query parameter is required.',
      );
    }

    const criteria: WorkManagementPermissionCriteriaDto = {
      projectTemplateId: query.projectTemplateId,
    };

    return this.workManagementPermissionService.findAll(criteria);
  }

  @Post()
  @AdminOnly()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_MANAGEMENT_PERMISSION_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORK_MANAGEMENT_PERMISSION_EDIT)
  @ApiOperation({ summary: 'Create work management permission' })
  @ApiResponse({ status: 201, type: WorkManagementPermissionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateWorkManagementPermissionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<WorkManagementPermissionResponseDto> {
    return this.workManagementPermissionService.create(
      dto,
      getAuditUserIdNumber(user),
    );
  }

  @Patch()
  @AdminOnly()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_MANAGEMENT_PERMISSION_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORK_MANAGEMENT_PERMISSION_EDIT)
  @ApiOperation({
    summary: 'Update work management permission',
    description: 'Target id is supplied in the request body as id.',
  })
  @ApiBody({ type: UpdateWorkManagementPermissionRequestDto })
  @ApiResponse({ status: 200, type: WorkManagementPermissionResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Body() dtoWithId: UpdateWorkManagementPermissionRequestDto,
    @CurrentUser() user: JwtUser,
  ): Promise<WorkManagementPermissionResponseDto> {
    const { id, ...dto } = dtoWithId;
    return this.workManagementPermissionService.update(
      this.workManagementPermissionService.parseId(id.toString()),
      dto as UpdateWorkManagementPermissionDto,
      getAuditUserIdNumber(user),
    );
  }

  @Delete()
  @HttpCode(204)
  @AdminOnly()
  @UseGuards(PermissionGuard)
  @Roles(...WORK_MANAGEMENT_PERMISSION_ROLES)
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.WORK_MANAGEMENT_PERMISSION_EDIT)
  @ApiOperation({ summary: 'Delete work management permission (soft delete)' })
  @ApiQuery({
    name: 'id',
    required: true,
    type: Number,
    description: 'Work management permission id',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(
    @Query() query: WorkManagementPermissionIdQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.workManagementPermissionService.delete(
      this.workManagementPermissionService.parseId(query.id.toString()),
      getAuditUserIdNumber(user),
    );
  }
}
