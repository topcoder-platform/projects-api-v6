import { ApiProperty } from '@nestjs/swagger';

/**
 * API response payload for a plan config revision record.
 *
 * @property id Record id.
 * @property key Metadata key.
 * @property version Major version.
 * @property revision Minor revision.
 * @property config Plan config JSON.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class PlanConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  revision: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  config: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
