import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PriceConfigResponseDto } from './dto/price-config-response.dto';
import { PriceConfigService } from './price-config.service';

@ApiTags('Metadata - Price Configs')
@ApiBearerAuth()
@Controller('/projects/metadata/priceConfig')
export class PriceConfigController {
  constructor(private readonly priceConfigService: PriceConfigService) {}

  @Get(':key')
  @ApiOperation({
    summary: 'Get latest priceConfig revision of latest version',
    description:
      'Returns the latest revision from the latest version for the given priceConfig key.',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiResponse({ status: 200, type: PriceConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async getLatest(@Param('key') key: string): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.findLatestRevisionOfLatestVersion(key);
  }
}
