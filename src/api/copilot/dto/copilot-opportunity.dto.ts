import {
  CopilotApplicationStatus,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  parseOptionalBoolean,
  parseOptionalLooseInteger,
  parseOptionalStringArray,
} from 'src/shared/utils/dto-transform.utils';
import { CopilotSkillDto } from './copilot-request.dto';

/**
 * DTOs for listing and responding with copilot opportunities.
 */

/**
 * Minimal project metadata included in admin/manager opportunity responses.
 */
export class CopilotOpportunityProjectDto {
  @ApiProperty()
  name: string;
}

/**
 * Application summary for the current authenticated user.
 *
 * The list and detail endpoints expose this object only when the caller has a
 * numeric user id and has submitted a non-deleted application.
 */
export class CurrentUserCopilotApplicationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    enum: CopilotApplicationStatus,
    enumName: 'CopilotApplicationStatus',
  })
  status: CopilotApplicationStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/**
 * Flattened response merging opportunity fields with request data.
 * canApplyAsCopilot indicates whether the current user is eligible to apply.
 * Admin/manager callers also receive minimal nested project metadata.
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

  @ApiPropertyOptional({ type: () => CopilotOpportunityProjectDto })
  project?: CopilotOpportunityProjectDto;

  @ApiPropertyOptional({
    description:
      'Whether the authenticated user has a non-deleted application for this opportunity.',
  })
  hasApplied?: boolean;

  @ApiPropertyOptional({ type: () => CurrentUserCopilotApplicationDto })
  currentUserApplication?: CurrentUserCopilotApplicationDto;
}

/**
 * Pagination, filtering, sorting, and current-user application parameters for
 * opportunity discovery.
 *
 * `keyword`, `projectType`, `skill`, `perPage`, and `myApplications` are
 * compatibility aliases for the canonical fields documented below.
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
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Alias for pageSize.',
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalLooseInteger(value))
  @IsInt()
  @Min(1)
  @Max(200)
  perPage?: number;

  @ApiPropertyOptional({
    description:
      'Sort expression. Supported fields: createdAt, updatedAt, status, type, projectName, opportunityTitle, and startDate; each accepts asc or desc.',
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

  @ApiPropertyOptional({
    description:
      'Case-insensitive search across opportunity title, overview, project name, type, and skills.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Alias for search.',
    deprecated: true,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keyword?: string;

  @ApiPropertyOptional({
    description:
      'Opportunity statuses. Accepts comma-separated values, repeated parameters, or status[$in] bracket notation.',
    enum: CopilotOpportunityStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(CopilotOpportunityStatus, { each: true })
  status?: CopilotOpportunityStatus[];

  @ApiPropertyOptional({
    description: 'Exact project id.',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive partial project-name filter.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectName?: string;

  @ApiPropertyOptional({
    description:
      'Opportunity types. Accepts comma-separated values or repeated parameters.',
    enum: CopilotOpportunityType,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(CopilotOpportunityType, { each: true })
  type?: CopilotOpportunityType[];

  @ApiPropertyOptional({
    description: 'Alias for type.',
    deprecated: true,
    enum: CopilotOpportunityType,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(CopilotOpportunityType, { each: true })
  projectType?: CopilotOpportunityType[];

  @ApiPropertyOptional({
    description:
      'Skill ids or names; an opportunity matches when any requested skill matches case-insensitively.',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalStringArray(value))
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Alias for skills.',
    deprecated: true,
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalStringArray(value))
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  skill?: string[];

  @ApiPropertyOptional({
    description:
      'Inclusive lower bound for the requested start date (ISO date or date-time).',
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive upper bound for the requested start date (ISO date or date-time).',
  })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive lower bound for opportunity creation time (ISO date or date-time).',
  })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive upper bound for opportunity creation time (ISO date or date-time).',
  })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @ApiPropertyOptional({
    description:
      'Filters on whether the current authenticated user has applied. Requires a numeric authenticated user id.',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  applied?: boolean;

  @ApiPropertyOptional({
    description:
      'Convenience alias for applied=true. A false value leaves the result unfiltered.',
    deprecated: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  myApplications?: boolean;

  @ApiPropertyOptional({
    description:
      'Current-user application statuses. Requires a numeric authenticated user id and implies applied=true.',
    enum: CopilotApplicationStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalStringArray(value))
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(CopilotApplicationStatus, { each: true })
  applicationStatus?: CopilotApplicationStatus[];
}
