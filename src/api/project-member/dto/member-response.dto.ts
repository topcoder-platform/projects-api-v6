import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Serialized project member response DTO.
 *
 * `handle` and `email` are only populated when the caller requests them via
 * `?fields=handle,email`.
 */
export class MemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  role: ProjectMemberRole;

  @ApiProperty()
  isPrimary: boolean;

  @ApiPropertyOptional()
  handle?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
