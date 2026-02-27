import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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
import {
  getAuditUserIdNumber,
  parsePositiveIntegerParam,
} from '../utils/metadata-utils';
import { CreatePlanConfigRevisionDto } from './dto/create-plan-config-revision.dto';
import { PlanConfigResponseDto } from './dto/plan-config-response.dto';
import { PlanConfigService } from './plan-config.service';

@ApiTags('Metadata - Plan Configs')
@ApiBearerAuth()
@Controller('/projects/metadata/planConfig/:key/versions/:version/revisions')
/**
 * REST controller for plan config revision operations.
 *
 * Read endpoints are currently unguarded; write endpoints require `@AdminOnly`.
 */
export class PlanConfigRevisionController {
  constructor(private readonly planConfigService: PlanConfigService) {}

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get()
  @ApiOperation({
    summary: 'List planConfig revisions by version',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiResponse({ status: 200, type: [PlanConfigResponseDto] })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Lists all revisions for a plan config version.
   */
  async listRevisions(
    @Param('key') key: string,
    @Param('version') version: string,
  ): Promise<PlanConfigResponseDto[]> {
    return this.planConfigService.findAllRevisions(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
    );
  }

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get(':revision')
  @ApiOperation({
    summary: 'Get specific planConfig revision',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiParam({ name: 'revision', description: 'PlanConfig revision' })
  @ApiResponse({ status: 200, type: PlanConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Fetches one specific plan config revision.
   */
  async getRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Param('revision') revision: string,
  ): Promise<PlanConfigResponseDto> {
    return this.planConfigService.findSpecificRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      BigInt(parsePositiveIntegerParam(revision, 'revision')),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create new revision under a planConfig version',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiResponse({ status: 201, type: PlanConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Creates a new revision under a plan config version.
   */
  async createRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: CreatePlanConfigRevisionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PlanConfigResponseDto> {
    return this.planConfigService.createRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':revision')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete a specific planConfig revision (soft delete)',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiParam({ name: 'revision', description: 'PlanConfig revision' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Soft deletes one plan config revision.
   */
  async deleteRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Param('revision') revision: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.planConfigService.deleteRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      BigInt(parsePositiveIntegerParam(revision, 'revision')),
      getAuditUserIdNumber(user),
    );
  }
}
