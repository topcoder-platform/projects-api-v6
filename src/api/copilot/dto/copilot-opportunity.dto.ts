import {
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CopilotSkillDto } from './copilot-request.dto';

/**
 * DTOs for listing and responding with copilot opportunities.
 */
function parseOptionalInteger(value: unknown): number | undefined {
  // TODO [DRY]: parseOptionalInteger is duplicated across copilot-request.dto.ts and copilot-application.dto.ts; extract shared dto transform utilities.
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  // TODO [DRY]: parseOptionalBoolean duplicates query transform logic; extract shared dto transform utilities.
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}

/**
 * Flattened response merging opportunity fields with request data.
 * canApplyAsCopilot indicates whether the current user is eligible to apply.
 */
export class CopilotOpportunityResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  projectId?: string;

  @ApiPropertyOptional()
  copilotRequestId?: string;

  @ApiProperty({
    enum: CopilotOpportunityStatus,
    enumName: 'CopilotOpportunityStatus',
  })
  status: CopilotOpportunityStatus;

  @ApiProperty({
    enum: CopilotOpportunityType,
    enumName: 'CopilotOpportunityType',
  })
  type: CopilotOpportunityType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  opportunityTitle?: string;

  @ApiPropertyOptional()
  copilotUsername?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'] })
  complexity?: string;

  @ApiPropertyOptional({ enum: ['yes', 'no'] })
  requiresCommunication?: string;

  @ApiPropertyOptional({ enum: ['standard', 'other'] })
  paymentType?: string;

  @ApiPropertyOptional()
  otherPaymentType?: string;

  @ApiPropertyOptional({
    enum: CopilotOpportunityType,
    enumName: 'CopilotOpportunityRequestType',
  })
  projectType?: CopilotOpportunityType;

  @ApiPropertyOptional()
  overview?: string;

  @ApiPropertyOptional({ type: () => [CopilotSkillDto] })
  skills?: CopilotSkillDto[];

  @ApiPropertyOptional()
  startDate?: string;

  @ApiPropertyOptional()
  numWeeks?: number;

  @ApiPropertyOptional()
  tzRestrictions?: string;

  @ApiPropertyOptional()
  numHoursPerWeek?: number;

  @ApiProperty()
  canApplyAsCopilot: boolean;

  @ApiPropertyOptional({ type: [String] })
  members?: string[];
}

/**
 * Pagination, sort, and noGrouping query parameters for opportunities.
 * noGrouping=false (default) groups results by status priority:
 * active -> canceled -> completed.
 */
export class ListOpportunitiesQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Sort expression. Supported: createdAt asc|desc.',
    example: 'createdAt desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'When false (default), opportunities are grouped by status priority: active, canceled, completed.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  noGrouping?: boolean;
}
