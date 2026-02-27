import { AttachmentType, InviteStatus, ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for serialized project member entries.
 */
export class ProjectMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  role: string;

  @ApiPropertyOptional()
  handle?: string | null;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * DTO for serialized project invite entries.
 */
export class ProjectInviteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiProperty({
    enum: InviteStatus,
    enumName: 'InviteStatus',
  })
  status: InviteStatus;

  @ApiProperty()
  role: string;

  @ApiPropertyOptional()
  handle?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * DTO for serialized project attachment entries.
 */
export class ProjectAttachmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty({
    enum: AttachmentType,
    enumName: 'AttachmentType',
  })
  type: AttachmentType;

  @ApiProperty({ maxLength: 2048 })
  path: string;

  @ApiPropertyOptional()
  size?: number | null;

  @ApiPropertyOptional()
  contentType?: string | null;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [Number] })
  allowedUsers?: number[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * DTO for serialized project entities.
 *
 * Uses string ids for bigint-backed columns and number values for decimal
 * price fields.
 */
export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  type: string;

  @ApiProperty({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
  })
  status: ProjectStatus;

  @ApiPropertyOptional()
  billingAccountId?: string | null;

  @ApiPropertyOptional()
  billingAccountName?: string | null;

  @ApiPropertyOptional()
  directProjectId?: string | null;

  @ApiPropertyOptional()
  estimatedPrice?: number | null;

  @ApiPropertyOptional()
  actualPrice?: number | null;

  @ApiPropertyOptional({ type: [String] })
  terms?: string[];

  @ApiPropertyOptional({ type: [String] })
  groups?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  external?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  bookmarks?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  details?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  challengeEligibility?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  templateId?: string | null;

  @ApiProperty()
  version: string;

  @ApiProperty()
  lastActivityAt: Date;

  @ApiProperty()
  lastActivityUserId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}

/**
 * DTO for project responses with optional relation collections.
 */
export class ProjectWithRelationsDto extends ProjectResponseDto {
  @ApiPropertyOptional({ type: () => [ProjectMemberDto] })
  members?: ProjectMemberDto[];

  @ApiPropertyOptional({ type: () => [ProjectInviteDto] })
  invites?: ProjectInviteDto[];

  @ApiPropertyOptional({ type: () => [ProjectAttachmentDto] })
  attachments?: ProjectAttachmentDto[];
}
