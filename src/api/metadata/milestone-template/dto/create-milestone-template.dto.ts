import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Request payload for creating a milestone template.
 *
 * @property name Milestone name.
 * @property description Optional milestone description.
 * @property duration Estimated duration.
 * @property type Milestone type.
 * @property order Display order.
 * @property plannedText Planned-state label text.
 * @property activeText Active-state label text.
 * @property completedText Completed-state label text.
 * @property blockedText Blocked-state label text.
 * @property reference Reference target type.
 * @property referenceId Reference target id.
 * @property metadata Optional metadata object.
 * @property hidden Hidden flag.
 */
export class CreateMilestoneTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  plannedText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activeText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  completedText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  blockedText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  referenceId: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
