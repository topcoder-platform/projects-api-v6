import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Request payload for creating a product category.
 *
 * @property key Category key.
 * @property displayName Category display name.
 * @property icon Icon identifier.
 * @property question Prompt text.
 * @property info Informational text.
 * @property aliases Alias list.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 */
export class CreateProductCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName: string;

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
