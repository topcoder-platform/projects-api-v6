import { ApiProperty } from '@nestjs/swagger';

/**
 * API response payload for product categories.
 *
 * @property key Category key.
 * @property displayName Category display name.
 * @property icon Icon identifier.
 * @property question Prompt text.
 * @property info Informational text.
 * @property aliases Alias list.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class ProductCategoryResponseDto {
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
