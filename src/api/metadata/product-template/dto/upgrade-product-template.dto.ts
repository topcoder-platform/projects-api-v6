import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { MetadataReferenceDto } from '../../dto/metadata-reference.dto';

/**
 * Request payload for upgrading a legacy product template.
 *
 * Migration semantics:
 * - If `form` is omitted, the existing form reference is preserved.
 * - If `form` is explicitly `null`, the legacy `template` payload is used to
 *   auto-create a new versioned form record.
 *
 * @property form Optional target form reference.
 */
export class UpgradeProductTemplateDto {
  @ApiPropertyOptional({ type: () => MetadataReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataReferenceDto)
  form?: MetadataReferenceDto;
}
