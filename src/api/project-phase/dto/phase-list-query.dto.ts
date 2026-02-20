import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
// TODO [DRY]: Duplicated in `workstream.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

/**
 * Query params for phase/work listing endpoints:
 * `GET /projects/:projectId/phases` and
 * `GET /projects/:projectId/workstreams/:workStreamId/works`.
 */
export class PhaseListQueryDto {
  @ApiPropertyOptional({
    description:
      'CSV field projection (for example: `id,name,products`). Supports phase fields plus `products`, `members`, and `approvals`.',
  })
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional({
    description:
      'Sort expression. Allowed fields: `startDate`, `endDate`, `status`, `order`.',
    example: 'startDate asc',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'If true, non-admin users only see phases where they are active members.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  memberOnly?: boolean;
}
