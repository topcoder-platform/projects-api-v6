import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * API response payload for project templates.
 *
 * @property id Template id.
 * @property name Template name.
 * @property key Template key.
 * @property category Category value.
 * @property subCategory Optional sub-category value.
 * @property metadata Template metadata object.
 * @property icon Icon identifier.
 * @property question Prompt text.
 * @property info Informational text.
 * @property aliases Alias list.
 * @property scope Legacy inline scope payload.
 * @property phases Legacy inline phases payload.
 * @property form Resolved form reference payload.
 * @property planConfig Resolved plan config reference payload.
 * @property priceConfig Resolved price config reference payload.
 * @property disabled Disabled flag.
 * @property hidden Hidden flag.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class ProjectTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  category: string;

  @ApiPropertyOptional()
  subCategory?: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown>;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  info: string;

  @ApiProperty({ type: [String] })
  aliases: unknown[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  scope?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  phases?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  form?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  planConfig?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  priceConfig?: Record<string, unknown> | null;

  @ApiProperty()
  disabled: boolean;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
