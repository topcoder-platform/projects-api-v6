import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * DTO for bulk project invite creation.
 *
 * `emails` are supported only for `customer` role targets.
 * `handles` resolve to existing Topcoder users.
 */
export class CreateInviteDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emails?: string[];

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
