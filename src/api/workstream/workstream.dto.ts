import { WorkStreamStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
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
// TODO [DRY]: Duplicated in `create-phase.dto.ts` and `create-phase-product.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

function parseOptionalInteger(value: unknown): number | undefined {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed === 'undefined') {
    return undefined;
  }

  return Math.trunc(parsed);
}
// TODO [DRY]: Duplicated in `create-phase.dto.ts` and `create-phase-product.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}
// TODO [DRY]: Duplicated in `phase-list-query.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

/**
 * Create payload for `POST /projects/:projectId/workstreams`.
 */
export class CreateWorkStreamDto {
  @ApiProperty({ description: 'Work stream name.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Work stream type key.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    enum: WorkStreamStatus,
    enumName: 'WorkStreamStatus',
  })
  @IsEnum(WorkStreamStatus)
  status: WorkStreamStatus;
}

/**
 * Partial update payload for `PATCH /projects/:projectId/workstreams/:id`.
 */
export class UpdateWorkStreamDto extends PartialType(CreateWorkStreamDto) {}

/**
 * Summary model for linked works embedded in work stream responses.
 */
export class WorkSummaryDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  status?: string | null;
}

/**
 * Response payload for work stream endpoints.
 */
export class WorkStreamResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty({
    enum: WorkStreamStatus,
    enumName: 'WorkStreamStatus',
  })
  status: WorkStreamStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;

  @ApiPropertyOptional({
    type: () => [WorkSummaryDto],
    description:
      'Linked works (project phases), included when `includeWorks=true`.',
  })
  works?: WorkSummaryDto[];
}

/**
 * List query payload for `GET /projects/:projectId/workstreams`.
 * Pagination defaults: `page=1`, `perPage=20`.
 */
export class WorkStreamListCriteria {
  @ApiPropertyOptional({
    enum: WorkStreamStatus,
    enumName: 'WorkStreamStatus',
  })
  @IsOptional()
  @IsEnum(WorkStreamStatus)
  status?: WorkStreamStatus;

  @ApiPropertyOptional({
    description:
      'Sort expression. Supported fields: name, status, createdAt, updatedAt.',
    example: 'updatedAt desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    minimum: 1,
    default: 1,
    description: 'Page number (default: 1).',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Page size (default: 20).',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

/**
 * Query payload for `GET /projects/:projectId/workstreams/:id`.
 */
export class WorkStreamGetCriteria {
  @ApiPropertyOptional({
    description:
      'When true, includes linked works (project phases) in the response.',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  includeWorks?: boolean;
}
