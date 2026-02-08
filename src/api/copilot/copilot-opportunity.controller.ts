import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
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
import { CopilotOpportunityService } from './copilot-opportunity.service';
import { AssignCopilotDto } from './dto/copilot-application.dto';
import {
  CopilotOpportunityResponseDto,
  ListOpportunitiesQueryDto,
} from './dto/copilot-opportunity.dto';

@ApiTags('Copilot Opportunities')
@ApiBearerAuth()
@Controller('/projects')
export class CopilotOpportunityController {
  constructor(private readonly service: CopilotOpportunityService) {}

  @Get('copilots/opportunities')
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @ApiOperation({
    summary: 'List copilot opportunities',
    description:
      'Lists available copilot opportunities. This endpoint is accessible to authenticated users, including copilots.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'noGrouping', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [CopilotOpportunityResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async listOpportunities(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ListOpportunitiesQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotOpportunityResponseDto[]> {
    const result = await this.service.listOpportunities(query, user);

    setProjectPaginationHeaders(
      req,
      res,
      result.page,
      result.perPage,
      result.total,
    );

    return result.data;
  }

  @Get('copilots/opportunity/:id')
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @ApiOperation({
    summary: 'Get copilot opportunity',
    description:
      'Returns one copilot opportunity with flattened request data and apply eligibility context for /projects/copilots/opportunity/:id.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, type: CopilotOpportunityResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOpportunity(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<CopilotOpportunityResponseDto> {
    return this.service.getOpportunity(id, user);
  }

  @Post('copilots/opportunity/:id/assign')
  @UseGuards(PermissionGuard)
  @Roles(UserRole.PROJECT_MANAGER, UserRole.TOPCODER_ADMIN)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.ASSIGN_COPILOT_OPPORTUNITY)
  @ApiOperation({
    summary: 'Assign copilot to opportunity',
    description:
      'Accepts one application, assigns the copilot to project members, fulfills the request, completes the opportunity, and cancels other applications.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiBody({ type: AssignCopilotDto })
  @ApiResponse({ status: 200, description: 'Copilot assigned' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @HttpCode(200)
  async assignCopilot(
    @Param('id') id: string,
    @Body() dto: AssignCopilotDto,
    @CurrentUser() user: JwtUser,
  ): Promise<{ id: string }> {
    return this.service.assignCopilot(id, dto, user);
  }

  @Delete('copilots/opportunity/:id/cancel')
  @UseGuards(PermissionGuard)
  @Roles(UserRole.PROJECT_MANAGER, UserRole.TOPCODER_ADMIN)
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.CANCEL_COPILOT_OPPORTUNITY)
  @ApiOperation({
    summary: 'Cancel copilot opportunity',
    description:
      'Cancels an opportunity and all related applications, then sends notifications to applicants.',
  })
  @ApiParam({ name: 'id', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Opportunity canceled' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async cancelOpportunity(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<{ id: string }> {
    return this.service.cancelOpportunity(id, user);
  }
}
