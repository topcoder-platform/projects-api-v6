import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../project/dto/pagination.dto';

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

export class ProjectShowcasePostListQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Sort expression. Example: "updatedAt desc"',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: 'Filter by post status (DRAFT, PUBLISHED, ARCHIVED)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  status?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Filter by project id (exact or $in pattern)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  projectId?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by industry id (exact or $in pattern)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  industryId?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by category id (exact or $in pattern)',
  })
  @IsOptional()
  @Transform(({ value }) => parseFilterInput(value))
  categoryId?: string | string[] | Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Filter by linked challenge id' })
  @IsOptional()
  @IsString()
  challengeId?: string;

  @ApiPropertyOptional({ description: 'Search text in title or content' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
