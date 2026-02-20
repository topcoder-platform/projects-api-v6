import { ApiProperty } from '@nestjs/swagger';

/**
 * API response payload for work management permissions.
 *
 * @property id Permission record id.
 * @property policy Policy identifier.
 * @property permission Permission payload object.
 * @property projectTemplateId Project template id.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class WorkManagementPermissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  policy: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  permission: Record<string, unknown>;

  @ApiProperty()
  projectTemplateId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
