import { InviteStatus, ProjectMemberRole } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Serialized project invite response DTO.
 */
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

/**
 * Represents a failed invite target in bulk invite operations.
 */
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

/**
 * Bulk invite response DTO with partial-failure support.
 *
 * `success` always contains created invites.
 * `failed` is present when some targets were rejected.
 */
export class InviteBulkResponseDto {
  @ApiProperty({ type: () => [InviteDto] })
  success: InviteDto[];

  @ApiPropertyOptional({ type: () => [InviteFailureDto] })
  failed?: InviteFailureDto[];
}
