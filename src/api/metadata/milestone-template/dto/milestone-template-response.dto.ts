import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * API response payload for milestone templates.
 *
 * @property id Record id.
 * @property name Milestone name.
 * @property description Optional milestone description.
 * @property duration Estimated duration.
 * @property type Milestone type.
 * @property order Display order.
 * @property plannedText Planned-state text.
 * @property activeText Active-state text.
 * @property completedText Completed-state text.
 * @property blockedText Blocked-state text.
 * @property hidden Hidden flag.
 * @property reference Reference type.
 * @property referenceId Reference id.
 * @property metadata Metadata object.
 * @property createdAt Creation timestamp.
 * @property updatedAt Update timestamp.
 * @property createdBy Creator user id.
 * @property updatedBy Updater user id.
 */
export class MilestoneTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  type: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  plannedText: string;

  @ApiProperty()
  activeText: string;

  @ApiProperty()
  completedText: string;

  @ApiProperty()
  blockedText: string;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  referenceId: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
