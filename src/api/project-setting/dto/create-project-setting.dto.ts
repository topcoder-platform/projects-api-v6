import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValueType } from '@prisma/client';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const PROJECT_SETTING_VALUE_TYPES = Object.values(ValueType);

export type ProjectSettingValueType = ValueType;

/**
 * DTO for creating project settings.
 *
 * `readPermission` and `writePermission` accept JSON objects that are evaluated
 * through `PermissionService.hasPermission` at runtime.
 */
export class CreateProjectSettingDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  value: string;

  @ApiProperty({ enum: PROJECT_SETTING_VALUE_TYPES })
  @IsString()
  @IsIn(PROJECT_SETTING_VALUE_TYPES)
  valueType: ProjectSettingValueType;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    default: {},
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Permission JSON structure used for read checks.',
  })
  @IsObject()
  readPermission: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Permission JSON structure used for write checks.',
  })
  @IsObject()
  writePermission: Record<string, unknown>;
}
