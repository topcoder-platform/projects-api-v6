import { ProjectMemberRole } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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

export class GetMemberQueryDto {
  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
