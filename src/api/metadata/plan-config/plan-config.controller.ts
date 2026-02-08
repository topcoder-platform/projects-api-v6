import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlanConfigResponseDto } from './dto/plan-config-response.dto';
import { PlanConfigService } from './plan-config.service';

@ApiTags('Metadata - Plan Configs')
@ApiBearerAuth()
@Controller('/projects/metadata/planConfig')
export class PlanConfigController {
  constructor(private readonly planConfigService: PlanConfigService) {}

  @Get(':key')
  @ApiOperation({
    summary: 'Get latest planConfig revision of latest version',
    description:
      'Returns the latest revision from the latest version for the given planConfig key.',
  })
  @ApiParam({ name: 'key', description: 'PlanConfig key' })
  @ApiResponse({ status: 200, type: PlanConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PlanConfig not found' })
  async getLatest(@Param('key') key: string): Promise<PlanConfigResponseDto> {
    return this.planConfigService.findLatestRevisionOfLatestVersion(key);
  }
}
