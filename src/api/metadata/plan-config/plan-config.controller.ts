import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/shared/decorators/public.decorator';
import { PlanConfigResponseDto } from './dto/plan-config-response.dto';
import { PlanConfigService } from './plan-config.service';

@ApiTags('Metadata - Plan Configs')
@Controller('/projects/metadata/planConfig')
/**
 * REST controller for reading public plan config metadata.
 */
export class PlanConfigController {
  constructor(private readonly planConfigService: PlanConfigService) {}

  @Public()
  @Get(':key')
  @ApiOperation({
    summary: 'Get latest planConfig revision of latest version',
    description:
      'Returns the latest revision from the latest version for the given planConfig key.',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiResponse({ status: 200, type: PlanConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  /**
   * Returns latest revision from latest version for a plan config key.
   *
   * HTTP 200 on success.
   */
  async getLatest(@Param('key') key: string): Promise<PlanConfigResponseDto> {
    return this.planConfigService.findLatestRevisionOfLatestVersion(key);
  }
}
