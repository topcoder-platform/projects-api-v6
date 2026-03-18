import { BadRequestException } from '@nestjs/common';
import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { parseNumericStringId } from 'src/shared/utils/service.utils';

/**
 * Parses optional user ids from query/body payloads while preserving exact
 * digits.
 *
 * @param value Raw unknown value from the incoming payload.
 * @returns A normalized numeric-string id when parseable, otherwise
 * `undefined`.
 * @throws {BadRequestException} If a provided value is not a numeric string or
 * finite number within the supported bigint range.
 */
function parseOptionalUserId(value: unknown): string | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return parseNumericStringId(
      String(Math.trunc(value)),
      'User id',
    ).toString();
  }

  if (typeof value === 'string' || typeof value === 'bigint') {
    return parseNumericStringId(String(value), 'User id').toString();
  }

  throw new BadRequestException('User id must be a numeric string.');
}

/**
 * DTO for creating a project member.
 *
 * Validation requires `role`. `userId` is normalized to a numeric string so
 * values beyond JavaScript's safe integer range are preserved exactly.
 */
export class CreateMemberDto {
  @ApiPropertyOptional({
    description: 'User id. Defaults to current user.',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalUserId(value))
  @IsString()
  userId?: string;

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
