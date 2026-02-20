import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Request payload for creating a project type.
 *
 * @property key Project type key.
 * @property displayName Project type display name.
 * @property icon Icon identifier.
 * @property question Prompt text.
 * @property info Informational text.
 * @property aliases Alias list.
 * @property metadata Metadata object.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 */
export class CreateProjectTypeDto {
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

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  metadata: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
