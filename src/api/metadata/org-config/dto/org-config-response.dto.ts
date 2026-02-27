import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * API response payload for org config entries.
 *
 * @property id Record id.
 * @property orgId Organization id.
 * @property configName Config key name.
 * @property configValue Optional config value.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class OrgConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orgId: string;

  @ApiProperty()
  configName: string;

  @ApiPropertyOptional()
  configValue?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
