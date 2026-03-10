import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MetadataReferenceDto } from '../../dto/metadata-reference.dto';

/**
 * Request payload for creating a project template.
 *
 * @property name Template display name.
 * @property key Template key used for lookups.
 * @property category High-level category label.
 * @property subCategory Optional sub-category label.
 * @property metadata Optional metadata object.
 * @property icon Icon identifier.
 * @property question Prompt text.
 * @property info Informational text.
 * @property aliases Alias list.
 * @property scope Legacy inline scope configuration.
 * @property phases Legacy inline phases configuration.
 * @property form Optional versioned form reference.
 * @property planConfig Optional versioned plan config reference.
 * @property priceConfig Optional versioned price config reference.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 */
export class CreateProjectTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  icon: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  info: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  aliases: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  phases?: Record<string, unknown>;

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
