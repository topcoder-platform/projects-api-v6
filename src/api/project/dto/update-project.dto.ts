import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';

/**
 * Parses optional project billing-account update input.
 *
 * @param value Raw `billingAccountId` value from request payload.
 * @returns Parsed integer, `null` when clearing, or `undefined` when omitted.
 */
function parseOptionalNullableInteger(value: unknown): number | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}

/**
 * Resolves whether the patch payload explicitly requests clearing
 * `billingAccountId`.
 *
 * @param value Raw `billingAccountId` value from request payload.
 * @returns `true` when caller explicitly sends `null` or an empty string.
 */
function parseClearBillingAccountFlag(value: unknown): boolean {
  return value === null || value === '';
}

/**
 * Request DTO for `PATCH /projects/:projectId`.
 *
 * Reuses `CreateProjectDto`, makes all fields optional via `PartialType`, and
 * allows `billingAccountId` to be explicitly cleared with `null` or `''`.
 */
export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, ['billingAccountId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Project billing account id. Send null or empty string to clear.',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNullableInteger(value))
  @IsNumber()
  billingAccountId?: number | null;

  @ApiHideProperty()
  @Transform(({ obj }) => parseClearBillingAccountFlag(obj?.billingAccountId))
  clearBillingAccountId?: boolean;
}
