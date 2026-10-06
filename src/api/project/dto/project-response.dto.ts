import { AttachmentType, InviteStatus, ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingAccount } from 'src/shared/services/billingAccount.service';

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
  cancelReason?: string | null;

  @ApiPropertyOptional()
  billingAccountId?: string | null;

  @ApiPropertyOptional()
  billingAccountName?: string | null;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'Current BillingAccount table fields and full client from the Billing Accounts API, with tcBillingAccountId and active compatibility aliases. Includes salesforceBillingAccountId, billingAccountType, billingNotes, billingFrequency, opportunity, subscription, spoc, secondarySpoc, costCenter, and workdayContractNumber. Missing metadata yields an id-only object; no assigned account yields null. Copilot-only callers do not receive markup.',
  })
  billingAccount: BillingAccount | null;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: true,
    description:
      'Full Client record associated with the current billing account, including Salesforce metadata, contact and billing address fields; null when unavailable.',
  })
  client: Record<string, unknown> | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'Unique billing accounts referenced by project challenges in all statuses, sorted by numeric account id. Each entry has the same metadata/client shape as billingAccount. Includes the current account only if a challenge references it. Empty when no accounts are referenced or the challenge lookup is unavailable.',
  })
  relatedBillingAccounts: BillingAccount[];

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
