import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * API response payload for product templates.
 *
 * @property id Template id.
 * @property name Template name.
 * @property productKey Product key.
 * @property category Category value.
 * @property subCategory Sub-category value.
 * @property icon Icon identifier.
 * @property brief Brief description.
 * @property details Detailed description.
 * @property aliases Alias list.
 * @property template Legacy inline template payload.
 * @property form Resolved form reference payload.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 * @property isAddOn Add-on flag.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class ProductTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  productKey: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  subCategory: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  brief: string;

  @ApiProperty()
  details: string;

  @ApiProperty({ type: [String] })
  aliases: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  template?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  form?: Record<string, unknown> | null;

  @ApiProperty()
  disabled: boolean;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  isAddOn: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
