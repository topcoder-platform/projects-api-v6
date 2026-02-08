import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { UpdateMilestoneDto } from './update-milestone.dto';

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

export class BulkUpdateMilestoneDto extends UpdateMilestoneDto {
  @ApiPropertyOptional({
    description:
      'Existing milestone id. If omitted, a new milestone is created as part of the bulk operation.',
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  id?: number;
}
