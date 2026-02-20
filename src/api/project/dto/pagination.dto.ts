import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Parses string/number pagination input into an integer.
 *
 * @param value Raw query value.
 * @returns Parsed integer or `undefined` for invalid/empty input.
 */
function parseNumberInput(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : Math.trunc(value);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

/**
 * Base pagination DTO for list-style query DTOs.
 *
 * Provides `page` (default 1, min 1) and `perPage` (default 20, min 1,
 * max 200).
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseNumberInput(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Results per page',
    default: 20,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Transform(({ value }) => parseNumberInput(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  perPage?: number = 20;
}
