import { ApiHideProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';

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
 * Reuses `CreateProjectDto` and makes all fields optional via `PartialType`.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiHideProperty()
  @Transform(({ obj }) => parseClearBillingAccountFlag(obj?.billingAccountId))
  clearBillingAccountId?: boolean;
}
