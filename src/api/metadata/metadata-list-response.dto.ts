import { ApiProperty } from '@nestjs/swagger';

/**
 * Aggregated metadata list response payload.
 *
 * @property projectTemplates Active project templates.
 * @property productTemplates Active product templates.
 * @property projectTypes Active project types.
 * @property productCategories Active product categories.
 * @property milestoneTemplates Active milestone templates.
 * @property forms Selected form records.
 * @property planConfigs Selected plan config records.
 * @property priceConfigs Selected price config records.
 */
export class MetadataListResponseDto {
  @ApiProperty({ type: [Object] })
  projectTemplates: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  productTemplates: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  projectTypes: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  productCategories: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  milestoneTemplates: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  forms: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  planConfigs: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  priceConfigs: Record<string, unknown>[];
}
