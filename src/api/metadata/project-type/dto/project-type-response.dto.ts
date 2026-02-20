import { ApiProperty } from '@nestjs/swagger';

/**
 * API response payload for project types.
 *
 * @property key Project type key.
 * @property displayName Display name.
 * @property icon Icon identifier.
 * @property question Prompt text.
 * @property info Informational text.
 * @property aliases Alias list.
 * @property metadata Metadata object.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class ProjectTypeResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  info: string;

  @ApiProperty({ type: [String] })
  aliases: unknown[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown>;

  @ApiProperty()
  disabled: boolean;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
