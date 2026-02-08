import {
  Body,
  Controller,
  Get,
  Param,
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
import { CopilotApplicationService } from './copilot-application.service';
import {
  CopilotApplicationListQueryDto,
  CopilotApplicationResponseDto,
  CreateCopilotApplicationDto,
} from './dto/copilot-application.dto';

@ApiTags('Copilot Applications')
@ApiBearerAuth()
@Controller('/projects')
export class CopilotApplicationController {
  constructor(private readonly service: CopilotApplicationService) {}

  @Post('copilots/opportunity/:id/apply')
  @UseGuards(PermissionGuard)
  @Roles(UserRole.TC_COPILOT)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.APPLY_COPILOT_OPPORTUNITY)
  @ApiOperation({
    summary: 'Apply to copilot opportunity',
    description:
      'Creates a new copilot application for an active opportunity. If the same user already applied, returns the existing record.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiBody({ type: CreateCopilotApplicationDto })
  @ApiResponse({ status: 201, type: CopilotApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async applyToOpportunity(
    @Param('id') id: string,
    @Body() dto: CreateCopilotApplicationDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotApplicationResponseDto> {
    return this.service.applyToOpportunity(id, dto, user);
  }

  @Get('copilots/opportunity/:id/applications')
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @ApiOperation({
    summary: 'List copilot applications',
    description:
      'Lists applications for one opportunity. Admins and PMs see full details, other users get a limited view.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiResponse({ status: 200, type: [CopilotApplicationResponseDto] })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async listApplications(
    @Param('id') id: string,
    @Query() query: CopilotApplicationListQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<unknown> {
    return this.service.listApplications(id, query, user);
  }
}
