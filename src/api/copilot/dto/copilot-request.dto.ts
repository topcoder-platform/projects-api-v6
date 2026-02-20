import {
  CopilotOpportunityStatus,
  CopilotOpportunityType,
  CopilotRequestStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Input/output DTOs for the copilot request lifecycle.
 */
function parseOptionalInteger(value: unknown): number | undefined {
  // TODO [DRY]: parseOptionalInteger is duplicated verbatim in copilot-opportunity.dto.ts and copilot-application.dto.ts; extract to src/shared/utils/dto-transforms.utils.ts (or similar).
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

export enum CopilotComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum CopilotRequiresCommunication {
  YES = 'yes',
  NO = 'no',
}

export enum CopilotPaymentType {
  STANDARD = 'standard',
  OTHER = 'other',
}

/**
 * Represents a skill tag attached to a copilot request.
 */
export class CopilotSkillDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}

/**
 * Validated payload for the data envelope of a new copilot request.
 * All fields are required except copilotUsername and otherPaymentType.
 */
export class CreateCopilotRequestDataDto {
  @ApiProperty({ description: 'Project id' })
  @Type(() => Number)
  @IsNumber()
  projectId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  opportunityTitle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  copilotUsername?: string;

  @ApiProperty({ enum: CopilotComplexity, enumName: 'CopilotComplexity' })
  @IsEnum(CopilotComplexity)
  complexity: CopilotComplexity;

  @ApiProperty({
    enum: CopilotRequiresCommunication,
    enumName: 'CopilotRequiresCommunication',
  })
  @IsEnum(CopilotRequiresCommunication)
  requiresCommunication: CopilotRequiresCommunication;

  @ApiProperty({ enum: CopilotPaymentType, enumName: 'CopilotPaymentType' })
  @IsEnum(CopilotPaymentType)
  paymentType: CopilotPaymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otherPaymentType?: string;

  @ApiProperty({
    enum: CopilotOpportunityType,
    enumName: 'CopilotOpportunityType',
  })
  @IsEnum(CopilotOpportunityType)
  projectType: CopilotOpportunityType;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  overview: string;

  @ApiProperty({ type: () => [CopilotSkillDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CopilotSkillDto)
  skills: CopilotSkillDto[];

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numWeeks: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tzRestrictions: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  numHoursPerWeek: number;
}

/**
 * Partial payload for PATCH operations on copilot request data.
 */
export class UpdateCopilotRequestDataDto extends PartialType(
  CreateCopilotRequestDataDto,
) {}

/**
 * Top-level envelope wrapper for create request payloads.
 */
export class CreateCopilotRequestDto {
  @ApiProperty({ type: () => CreateCopilotRequestDataDto })
  @ValidateNested()
  @Type(() => CreateCopilotRequestDataDto)
  data: CreateCopilotRequestDataDto;
}

/**
 * Top-level envelope wrapper for update request payloads.
 */
export class UpdateCopilotRequestDto {
  @ApiProperty({ type: () => UpdateCopilotRequestDataDto })
  @ValidateNested()
  @Type(() => UpdateCopilotRequestDataDto)
  data: UpdateCopilotRequestDataDto;
}

/**
 * Embedded opportunity summary returned in request responses.
 */
export class CopilotRequestOpportunityResponseDto {
  @ApiProperty()
  id: string;

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
}

/**
 * Full response shape for a copilot request.
 */
export class CopilotRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  projectId?: string;

  @ApiPropertyOptional({ type: Object })
  project?: Record<string, unknown>;

  @ApiProperty({ enum: CopilotRequestStatus, enumName: 'CopilotRequestStatus' })
  status: CopilotRequestStatus;

  @ApiProperty({ type: Object })
  data: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;

  @ApiPropertyOptional({ type: () => [CopilotRequestOpportunityResponseDto] })
  copilotOpportunity?: CopilotRequestOpportunityResponseDto[];
}

/**
 * Pagination and sort query parameters for request listing endpoints.
 */
export class CopilotRequestListQueryDto {
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
    description:
      'Sort expression. Supported: createdAt asc|desc, projectName asc|desc, opportunityTitle asc|desc, projectType asc|desc, status asc|desc.',
    example: 'createdAt desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
