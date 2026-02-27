import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { MetadataReferenceDto } from '../../dto/metadata-reference.dto';

/**
 * Request payload for upgrading a legacy project template.
 *
 * Migration semantics:
 * - If a reference field is omitted, the existing stored reference is
 * preserved.
 * - If a reference field is explicitly `null`, legacy inline payloads
 * (`scope`/`phases`) are used to auto-create a new versioned metadata record.
 *
 * @property form Optional target form reference.
 * @property planConfig Optional target plan config reference.
 * @property priceConfig Optional target price config reference.
 */
export class UpgradeProjectTemplateDto {
  @ApiPropertyOptional({ type: () => MetadataReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataReferenceDto)
  form?: MetadataReferenceDto;

  @ApiPropertyOptional({ type: () => MetadataReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataReferenceDto)
  planConfig?: MetadataReferenceDto;

  @ApiPropertyOptional({ type: () => MetadataReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataReferenceDto)
  priceConfig?: MetadataReferenceDto;
}
