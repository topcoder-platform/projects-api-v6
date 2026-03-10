import {
  Body,
  Controller,
  Delete,
  Get,
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
import {
  getAuditUserIdNumber,
  parsePositiveIntegerParam,
} from '../utils/metadata-utils';
import { CreatePlanConfigVersionDto } from './dto/create-plan-config-version.dto';
import { PlanConfigResponseDto } from './dto/plan-config-response.dto';
import { UpdatePlanConfigVersionDto } from './dto/update-plan-config-version.dto';
import { PlanConfigService } from './plan-config.service';

@ApiTags('Metadata - Plan Configs')
@ApiBearerAuth()
@Controller('/projects/metadata/planConfig/:key/versions')
/**
 * REST controller for plan config version operations.
 *
 * Read endpoints are currently unguarded; write endpoints require `@AdminOnly`.
 */
export class PlanConfigVersionController {
  constructor(private readonly planConfigService: PlanConfigService) {}

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get()
  @ApiOperation({
    summary: 'List planConfig versions',
    description:
      'Returns latest revision for each version of a planConfig key.',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiResponse({ status: 200, type: [PlanConfigResponseDto] })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Lists latest revision per version for a plan config key.
   */
  async listVersions(
    @Param('key') key: string,
  ): Promise<PlanConfigResponseDto[]> {
    return this.planConfigService.findAllVersions(key);
  }

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get(':version')
  @ApiOperation({
    summary: 'Get latest revision by planConfig version',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiResponse({ status: 200, type: PlanConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Fetches latest revision for one plan config version.
   */
  async getVersion(
    @Param('key') key: string,
    @Param('version') version: string,
  ): Promise<PlanConfigResponseDto> {
    return this.planConfigService.findLatestRevisionOfVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create a new planConfig version',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiResponse({ status: 201, type: PlanConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  /**
   * Creates a new plan config version.
   */
  async createVersion(
    @Param('key') key: string,
    @Body() dto: CreatePlanConfigVersionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PlanConfigResponseDto> {
    return this.planConfigService.createVersion(
      key,
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Patch(':version')
  @AdminOnly()
  @ApiOperation({
    summary: 'Update latest revision for a planConfig version',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiResponse({ status: 200, type: PlanConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Updates the latest revision of a plan config version.
   */
  async updateVersion(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: UpdatePlanConfigVersionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PlanConfigResponseDto> {
    return this.planConfigService.updateVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':version')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete all revisions of a planConfig version (soft delete)',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiParam({ name: 'version', description: 'PlanConfig version' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Soft deletes all revisions of a plan config version.
   */
  async deleteVersion(
    @Param('key') key: string,
    @Param('version') version: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.planConfigService.deleteVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      getAuditUserIdNumber(user),
    );
  }
}
