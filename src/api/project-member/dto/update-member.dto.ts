import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * DTO for updating an existing project member.
 *
 * `role` is required (no `@IsOptional()`), so callers must always provide it
 * even when they only want to update `isPrimary`.
 */
export class UpdateMemberDto {
  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    description: 'Supported value: complete-copilot-requests',
  })
  // TODO: QUALITY: `action` is free-form; only
  // `complete-copilot-requests` is documented. Use enum or `@IsIn([...])`.
  @IsOptional()
  @IsString()
  action?: string;
}
