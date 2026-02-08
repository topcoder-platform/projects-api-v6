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

function parseOptionalInteger(value: unknown): number | undefined {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed === 'undefined') {
    return undefined;
  }

  return Math.trunc(parsed);
}

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

export class CreateWorkStreamDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
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

export class UpdateWorkStreamDto extends PartialType(CreateWorkStreamDto) {}

export class WorkSummaryDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  status?: string | null;
}

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

  @ApiPropertyOptional({ type: () => [WorkSummaryDto] })
  works?: WorkSummaryDto[];
}

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

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}

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
