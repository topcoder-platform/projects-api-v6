import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { parseNumericStringId } from 'src/shared/utils/service.utils';

/**
 * Parses optional integer-like input values from query/body payloads.
 *
 * @param value Raw unknown value from the incoming payload.
 * @returns A truncated number when parseable, otherwise `undefined`.
 * @throws {BadRequestException} If a provided value is not a numeric string or
 * finite number.
 */
function parseOptionalInteger(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number(
      parseNumericStringId(String(Math.trunc(value)), 'User id'),
    );
  }

  return Number(parseNumericStringId(String(value), 'User id'));
}

/**
 * DTO for creating a project member.
 *
 * Validation requires `role`, while the service still defensively falls back
 * to `getDefaultProjectRole` when role is missing in runtime payloads.
 */
export class CreateMemberDto {
  @ApiPropertyOptional({ description: 'User id. Defaults to current user.' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  userId?: number;

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
