import { ApiProperty } from '@nestjs/swagger';

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
