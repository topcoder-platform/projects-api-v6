import {
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import {
  parseOptionalBoolean,
  parseOptionalLooseInteger,
} from 'src/shared/utils/dto-transform.utils';
import { CopilotSkillDto } from './copilot-request.dto';

/**
 * DTOs for listing and responding with copilot opportunities.
 */

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
  @Transform(({ value }) => parseOptionalLooseInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalLooseInteger(value))
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
