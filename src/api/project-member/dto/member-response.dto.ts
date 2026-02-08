import { ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
