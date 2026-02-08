import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';

function parseBoolean(value: unknown): boolean | undefined {
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

function parseFilterInput(
  value: unknown,
): string | string[] | Record<string, unknown> | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }

  return undefined;
}

export class ProjectListQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Sort expression. Example: "lastActivityAt desc"',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'CSV fields list. Supported: members, invites, attachments, phases',
  })
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional({
    description: 'Filter by project id (exact or $in pattern)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  id?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Filter by status (exact or $in pattern)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  status?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'When true, return projects where current user is member/invitee',
  })
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  memberOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Keyword for text search over name/description',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Filter by project type (exact or $in pattern)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  type?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Filter by customer user id',
  })
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiPropertyOptional({
    description: 'Filter by manager user id',
  })
  @IsOptional()
  @IsString()
  manager?: string;

  @ApiPropertyOptional({
    description: 'Filter by directProjectId',
  })
  @IsOptional()
  @IsString()
  directProjectId?: string;
}

export class GetProjectQueryDto {
  @ApiPropertyOptional({
    description:
      'CSV fields list. Supported: members, invites, attachments, phases',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
