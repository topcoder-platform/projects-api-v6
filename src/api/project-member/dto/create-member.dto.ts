import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';

/**
 * Parses optional integer-like input values from query/body payloads.
 *
 * @param value Raw unknown value from the incoming payload.
 * @returns A truncated number when parseable, otherwise `undefined`.
 * @throws {TypeError} Propagates only if value conversion throws unexpectedly.
 */
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
