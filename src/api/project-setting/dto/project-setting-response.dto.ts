import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PROJECT_SETTING_VALUE_TYPES,
  ProjectSettingValueType,
} from './create-project-setting.dto';

/**
 * Serialized project setting response DTO.
 *
 * `value` and `valueType` are optional in responses even though both are
 * required on create.
 */
export class ProjectSettingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  key: string;

  @ApiPropertyOptional()
  value?: string | null;

  @ApiPropertyOptional({ enum: PROJECT_SETTING_VALUE_TYPES })
  valueType?: ProjectSettingValueType | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  readPermission: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  writePermission: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
