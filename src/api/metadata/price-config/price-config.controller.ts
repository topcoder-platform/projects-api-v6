import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/shared/decorators/public.decorator';
import { PriceConfigResponseDto } from './dto/price-config-response.dto';
import { PriceConfigService } from './price-config.service';

@ApiTags('Metadata - Price Configs')
@Controller('/projects/metadata/priceConfig')
/**
 * REST controller for reading public price config metadata.
 */
export class PriceConfigController {
  constructor(private readonly priceConfigService: PriceConfigService) {}

  @Public()
  @Get(':key')
  @ApiOperation({
    summary: 'Get latest priceConfig revision of latest version',
    description:
      'Returns the latest revision from the latest version for the given priceConfig key.',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiResponse({ status: 200, type: PriceConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  /**
   * Returns latest revision from latest version for a price config key.
   */
  async getLatest(@Param('key') key: string): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.findLatestRevisionOfLatestVersion(key);
  }
}
