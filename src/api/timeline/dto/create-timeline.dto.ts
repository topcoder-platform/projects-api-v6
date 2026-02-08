import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimelineReference } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

function parseOptionalInteger(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

export class CreateTimelineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;

  @ApiProperty({
    enum: TimelineReference,
    enumName: 'TimelineReference',
  })
  @IsEnum(TimelineReference)
  reference: TimelineReference;

  @ApiProperty({ minimum: 1 })
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  referenceId: number;

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Optional product template id used to create default milestones from milestone templates.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  templateId?: number;
}
