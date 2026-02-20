import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
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
// TODO [DRY]: Duplicated in `create-phase.dto.ts` and `workstream.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

function parseOptionalInteger(value: unknown): number | undefined {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed === 'undefined') {
    return undefined;
  }

  return Math.trunc(parsed);
}
// TODO [DRY]: Duplicated in `create-phase.dto.ts` and `workstream.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

/**
 * Create payload for phase product/work-item endpoints:
 * `POST /projects/:projectId/phases/:phaseId/products` and
 * `POST /projects/:projectId/workstreams/:workStreamId/works/:workId/workitems`.
 */
export class CreatePhaseProductDto {
  @ApiProperty({ description: 'Product/work-item name.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Product/work-item type key.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ description: 'Optional product template id.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(1)
  templateId?: number;

  @ApiPropertyOptional({
    description:
      'Optional direct project id. Defaults to parent project directProjectId when omitted.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(1)
  directProjectId?: number;

  @ApiPropertyOptional({
    description:
      'Optional billing account id. Defaults to parent project billingAccountId when omitted.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(1)
  billingAccountId?: number;

  @ApiPropertyOptional({ description: 'Estimated product price.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(1)
  estimatedPrice?: number;

  @ApiPropertyOptional({ description: 'Actual product price.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(1)
  actualPrice?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}
