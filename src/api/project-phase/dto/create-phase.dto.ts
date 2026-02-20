import { ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}
// TODO [DRY]: Duplicated in `create-phase-product.dto.ts` and `workstream.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

function parseOptionalInteger(value: unknown): number | undefined {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed === 'undefined') {
    return undefined;
  }

  return Math.trunc(parsed);
}
// TODO [DRY]: Duplicated in `create-phase-product.dto.ts` and `workstream.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

function parseOptionalIntegerArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === 'number');
}
// TODO [DRY]: Duplicated in `create-phase-product.dto.ts` and `workstream.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

/**
 * Create payload for project phase creation endpoints:
 * `POST /projects/:projectId/phases` and
 * `POST /projects/:projectId/workstreams/:workStreamId/works`.
 */
export class CreatePhaseDto {
  @ApiProperty({ description: 'Human-readable phase/work name.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Optional phase description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional requirements narrative.' })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiProperty({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
  })
  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @ApiPropertyOptional({ description: 'Planned phase start date.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'Planned phase end date.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({ minimum: 0, description: 'Planned duration in days.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Planned budget amount.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Actual spent budget amount.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  spentBudget?: number;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Progress percentage value.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  progress?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional explicit order position within project phases.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  order?: number;

  @ApiPropertyOptional({
    description:
      'Optional product template id to seed one PhaseProduct during creation.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  productTemplateId?: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Optional user ids for bulk phase-member assignment.',
  })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => parseOptionalIntegerArray(value))
  @IsInt({ each: true })
  members?: number[];
}
