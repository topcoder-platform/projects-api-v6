import { ApiProperty } from '@nestjs/swagger';

/**
 * API response payload for a form revision record.
 *
 * @property id Form record id.
 * @property key Form key.
 * @property version Major version.
 * @property revision Minor revision.
 * @property config Form configuration JSON.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class FormResponseDto {
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
