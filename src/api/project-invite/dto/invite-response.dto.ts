import { InviteStatus, ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty({ enum: ProjectMemberRole, enumName: 'ProjectMemberRole' })
  role: ProjectMemberRole;

  @ApiProperty({ enum: InviteStatus, enumName: 'InviteStatus' })
  status: InviteStatus;

  @ApiPropertyOptional()
  handle?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class InviteFailureDto {
  @ApiPropertyOptional()
  handle?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  role?: string;
}

export class InviteBulkResponseDto {
  @ApiProperty({ type: () => [InviteDto] })
  success: InviteDto[];

  @ApiPropertyOptional({ type: () => [InviteFailureDto] })
  failed?: InviteFailureDto[];
}
