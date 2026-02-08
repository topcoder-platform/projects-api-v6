import {
  AttachmentType,
  EstimationType,
  ProjectMemberRole,
  ProjectStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

function parseOptionalInteger(value: unknown): number | undefined {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed === 'undefined') {
    return undefined;
  }

  return Math.trunc(parsed);
}

function parseAllowedUsers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === 'number');
}

export class ProjectUtmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medium?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  term?: string;
}

export class BookmarkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: 'https://www.topcoder.com' })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}

export class ProjectExternalDto {
  @ApiPropertyOptional({
    description: 'External links or metadata for third-party systems.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class ChallengeEligibilityDto {
  @ApiPropertyOptional({
    description: 'Challenge eligibility rules metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class EstimationItemDto {
  @ApiProperty({
    enum: EstimationType,
    enumName: 'EstimationType',
  })
  @IsEnum(EstimationType)
  type: EstimationType;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  markupUsedReference: string;

  @ApiProperty()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(0)
  markupUsedReferenceId: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EstimationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  buildingBlockKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  conditions: string;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(0)
  minTime: number;

  @ApiProperty({ minimum: 0 })
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(0)
  maxTime: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: () => [EstimationItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimationItemDto)
  items?: EstimationItemDto[];
}

export class ProjectAttachmentInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    enum: AttachmentType,
    enumName: 'AttachmentType',
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiProperty({
    description: 'Attachment file path or URL',
    maxLength: 2048,
  })
  @IsString()
  @Length(1, 2048)
  path: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  @Min(0)
  size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => parseAllowedUsers(value))
  @IsNumber({}, { each: true })
  allowedUsers?: number[];
}

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional({
    description: 'Project description',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 5000)
  description?: string;

  @ApiProperty({
    description: 'Project type key',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  billingAccountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  directProjectId?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000000 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @Max(100000000)
  estimatedPrice?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000000 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalNumber(value))
  @IsNumber()
  @Min(0)
  @Max(100000000)
  actualPrice?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  terms?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groups?: string[];

  @ApiPropertyOptional({ type: () => ProjectUtmDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectUtmDto)
  utm?: ProjectUtmDto;

  @ApiPropertyOptional({ type: () => [BookmarkDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookmarkDto)
  bookmarks?: BookmarkDto[];

  @ApiPropertyOptional({ type: () => ProjectExternalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectExternalDto)
  external?: ProjectExternalDto;

  @ApiPropertyOptional({
    description: 'Arbitrary project details metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @ApiPropertyOptional({ type: () => ChallengeEligibilityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChallengeEligibilityDto)
  challengeEligibility?: ChallengeEligibilityDto;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  templateId?: number;

  @ApiPropertyOptional({
    description: 'Project version',
    default: 'v3',
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @Length(1, 3)
  version?: string;

  @ApiPropertyOptional({ type: () => [EstimationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimationDto)
  estimation?: EstimationDto[];

  @ApiPropertyOptional({ type: () => [ProjectAttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectAttachmentInputDto)
  attachments?: ProjectAttachmentInputDto[];

  @ApiPropertyOptional({
    description: 'Initial members to add at creation time',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  members?: Array<{
    userId: number;
    role: ProjectMemberRole;
    isPrimary?: boolean;
  }>;
}
