import { ProjectMemberRole } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Query DTO for listing project members.
 *
 * `fields` accepts a CSV list such as
 * `handle,email,firstName,lastName`.
 */
export class MemberListQueryDto {
  @ApiPropertyOptional({
    enum: ProjectMemberRole,
    enumName: 'ProjectMemberRole',
  })
  @IsOptional()
  @IsEnum(ProjectMemberRole)
  role?: ProjectMemberRole;

  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}

/**
 * Query DTO for fetching a single project member.
 *
 * `fields` accepts a CSV list such as
 * `handle,email,firstName,lastName`.
 */
export class GetMemberQueryDto {
  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
