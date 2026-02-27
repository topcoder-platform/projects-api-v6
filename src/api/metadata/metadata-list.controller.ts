import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/shared/decorators/public.decorator';
import { parseOptionalBooleanQuery } from './utils/metadata-utils';
import { MetadataListResponseDto } from './metadata-list-response.dto';
import {
  MetadataListResponse,
  MetadataListService,
} from './metadata-list.service';

@ApiTags('Metadata')
@Controller('/projects/metadata')
/**
 * Exposes `GET /projects/metadata` as a single public endpoint that returns
 * all active metadata in one payload for UI bootstrapping.
 *
 * This endpoint is consumed by `platform-ui` on initial load to hydrate
 * project/product template and category selectors.
 */
export class MetadataListController {
  constructor(private readonly metadataListService: MetadataListService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List all metadata',
    description:
      'Returns project metadata in one payload. includeAllReferred=true includes latest and template-referred versions for Form/PlanConfig/PriceConfig.',
  })
  @ApiQuery({
    name: 'includeAllReferred',
    required: false,
    type: Boolean,
    description:
      'When true, includes all versions referred by templates plus latest versions.',
  })
  @ApiResponse({ status: 200, type: MetadataListResponseDto })
  /**
   * Returns all active metadata grouped by resource type.
   *
   * @param includeAllReferred When `true`, includes template-referenced
   * versions in addition to the latest version per key for form/plan/price
   * configs.
   * @returns Aggregated metadata payload. If no rows exist, resource arrays are
   * returned empty.
   */
  async getAllMetadata(
    @Query('includeAllReferred') includeAllReferred?: string,
  ): Promise<MetadataListResponse> {
    return this.metadataListService.getAllMetadata(
      parseOptionalBooleanQuery(includeAllReferred) || false,
    );
  }
}
