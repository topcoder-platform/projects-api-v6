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
 * Request payload for creating a product template.
 *
 * @property name Template name.
 * @property productKey Product key used for lookups.
 * @property category Category value.
 * @property subCategory Sub-category value.
 * @property icon Icon identifier.
 * @property brief Brief description.
 * @property details Detailed description.
 * @property aliases Alias list.
 * @property template Legacy inline template JSON.
 * @property form Optional versioned form reference.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 * @property isAddOn Add-on flag.
 */
export class CreateProductTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subCategory: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  icon: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  brief: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  details: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  aliases: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  template?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => MetadataReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataReferenceDto)
  form?: MetadataReferenceDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAddOn?: boolean;
}
