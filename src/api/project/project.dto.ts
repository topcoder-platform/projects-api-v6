/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
  IsNumberString,
  IsBoolean,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DEFAULT_PAGE_SIZE, PROJECT_STATUS } from 'src/shared/constants';
import { ProjectMemberResponseDto } from '../projectMember/project-member.dto';

// DTOs for nested objects
class UtmDto {
  @ApiPropertyOptional({ description: 'source' })
  @IsString()
  @IsOptional()
  source?: string | null;

  @ApiPropertyOptional({ description: 'medium' })
  @IsString()
  @IsOptional()
  medium?: string | null;

  @ApiPropertyOptional({ description: 'campaign' })
  @IsString()
  @IsOptional()
  campaign?: string | null;
}

enum ExternalType {
  GITHUB = 'github',
  JIRA = 'jira',
  ASANA = 'asana',
  OTHER = 'other',
}

class ExternalDto {
  @ApiProperty({ description: 'external type', enum: ExternalType })
  @IsEnum(ExternalType)
  type: ExternalType;

  @ApiProperty({ description: 'external data' })
  @IsString()
  @MaxLength(300)
  data: string;

  @ApiProperty({ description: 'external id' })
  @IsString()
  extId: string;
}

enum EligibilityRole {
  SUBMITTER = 'submitter',
  REVIEWER = 'reviewer',
  COPILOT = 'copilot',
}

class ChallengeEligibilityDto {
  @ApiProperty({ description: 'Eligibility role', enum: EligibilityRole })
  @IsEnum(EligibilityRole)
  role: EligibilityRole;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  users: number[];

  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  groups: number[];
}

class EstimationMetadataDto {
  @ApiPropertyOptional({ example: 'dev-qa' })
  @IsString()
  @IsOptional()
  deliverable?: string;

  @ApiProperty({ example: 3200 })
  @IsNumber()
  @IsOptional()
  priceFormula?: number;
}

@ApiExtraModels(EstimationMetadataDto)
class EstimationDto {
  @ApiProperty({
    example: '( HAS_DESIGN_DELIVERABLE && HAS_UI_PROTOTYPE_ADDON )',
  })
  @IsString()
  conditions: string;

  @ApiProperty({ example: 3200 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  minTime: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  maxTime: number;

  @ApiProperty({ example: 'UI_PROTOTYPE_ADDON' })
  @IsString()
  buildingBlockKey: string;

  @ApiPropertyOptional({ name: 'metadata', type: EstimationMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EstimationMetadataDto)
  metadata?: EstimationMetadataDto;
}

@ApiExtraModels(EstimationDto)
class EstimationResponseDto extends EstimationDto {
  @ApiProperty({ example: 1000002 })
  id: number;

  @ApiProperty({ example: 1000336 })
  projectId: number;

  @ApiProperty({ example: '2025-01-29T15:04:26.096Z' })
  createdAt: string;

  @ApiProperty({ example: 22880988 })
  createdBy: number;

  @ApiProperty({ example: '2025-01-29T15:04:26.096Z' })
  updatedAt?: string | null;

  @ApiProperty({ example: 22880988 })
  updatedBy?: number | null;
}

class AttachmentDto {
  @ApiProperty({ example: '' })
  @IsString()
  category: string;

  @ApiPropertyOptional({})
  @IsString()
  @IsOptional()
  contentType?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty()
  @IsString()
  path: string;

  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty()
  @IsNumber()
  size: number;

  @ApiProperty()
  @IsString()
  title: string;
}

class BookmarkDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  address: string;
}

export class ProjectDetailUtmDto {
  @ApiPropertyOptional({ name: 'code', description: 'utm code' })
  @IsString()
  @IsOptional()
  code?: string;
}

export class ProjectDetailSettingDto {
  @ApiPropertyOptional({
    name: 'workstreams',
    description: 'workstreams enabled or not',
  })
  @IsBoolean()
  @IsOptional()
  workstreams?: boolean;
}

export class ProjectDetailAppDefinitionDto {
  @ApiPropertyOptional({ name: 'budget', description: 'budget' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ type: [String], description: 'deliverables' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deliverables?: string[];

  @ApiPropertyOptional({ type: [String], description: 'expected Outcome' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expectedOutcome?: string[];

  @ApiPropertyOptional({ type: [String], description: 'design Goal' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  designGoal?: string[];

  @ApiPropertyOptional({
    description: 'need Additional Screens? Can be yes or no',
  })
  @IsOptional()
  needAdditionalScreens?: string;

  @ApiPropertyOptional({ type: [String], description: 'target Devices' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetDevices?: string[];

  @ApiPropertyOptional({
    description: 'web Browser Behaviour',
    example: 'responsive',
  })
  @IsOptional()
  webBrowserBehaviour?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'web Browsers Supported',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  webBrowsersSupported?: string[];

  @ApiPropertyOptional({
    description: 'has Brand Guidelines? Can be yes or no',
  })
  @IsOptional()
  hasBrandGuidelines?: string;

  @ApiPropertyOptional({ description: 'need Specific Fonts? Can be yes or no' })
  @IsOptional()
  needSpecificFonts?: string;

  @ApiPropertyOptional({
    description: 'need Specific Colors? Can be yes or no',
  })
  @IsOptional()
  needSpecificColors?: string;
}

export class ProjectDetailProjectDataDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerProject?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  executionHub?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  groupCustomerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  projectCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  groupName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  costCenter?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  wbsCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  onsiteEfforts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  offshoreEfforts?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  plannedStartDate?: Date;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  plannedEndDate?: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  partOfNg3?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  companyCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  approvedAmount?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  projectClassificationCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  invoiceType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sowNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sector?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  smu?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subExecutionHub?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  initiatorEmail?: string;

  @ApiProperty({ description: 'Reference to ProjectDetail ID' })
  @Type(() => Number)
  projectDetailId: bigint;
}

export class ProjectDetailTechstackDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  frameworks?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  database?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hosting?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  others?: string;

  @ApiProperty({ description: 'Reference to ProjectDetail ID' })
  @Type(() => Number)
  projectDetailId: bigint;
}

export class ProjectDetailApiDefinitionDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  addons?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deliverables?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deploymentTargets?: string[];

  @ApiProperty({ description: 'Reference to ProjectDetail ID' })
  @Type(() => Number)
  projectDetailId: bigint;
}

@ApiExtraModels(
  ProjectDetailUtmDto,
  ProjectDetailSettingDto,
  ProjectDetailAppDefinitionDto,
  ProjectDetailProjectDataDto,
  ProjectDetailTechstackDto,
  ProjectDetailApiDefinitionDto,
)
export class ProjectDetailDto {
  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  products?: string[];

  @ApiPropertyOptional({})
  @IsOptional()
  intakePurpose?: string;

  @ApiPropertyOptional({})
  @IsOptional()
  hideDiscussions?: boolean;

  @ApiPropertyOptional({ type: ProjectDetailUtmDto })
  @Type(() => ProjectDetailUtmDto)
  @ValidateNested()
  @IsOptional()
  utm?: ProjectDetailUtmDto;

  @ApiPropertyOptional({ type: ProjectDetailSettingDto })
  @Type(() => ProjectDetailSettingDto)
  @ValidateNested()
  @IsOptional()
  setting?: ProjectDetailSettingDto;

  @ApiPropertyOptional({ type: ProjectDetailAppDefinitionDto })
  @Type(() => ProjectDetailAppDefinitionDto)
  @ValidateNested()
  @IsOptional()
  appDefinition?: ProjectDetailAppDefinitionDto;

  @ApiPropertyOptional({ type: ProjectDetailProjectDataDto })
  @Type(() => ProjectDetailProjectDataDto)
  @ValidateNested()
  @IsOptional()
  projectData?: ProjectDetailProjectDataDto;

  @ApiPropertyOptional({ type: ProjectDetailTechstackDto })
  @Type(() => ProjectDetailTechstackDto)
  @ValidateNested()
  @IsOptional()
  techstack?: ProjectDetailTechstackDto;

  @ApiPropertyOptional({ type: ProjectDetailApiDefinitionDto })
  @Type(() => ProjectDetailApiDefinitionDto)
  @ValidateNested()
  @IsOptional()
  apiDefinition?: ProjectDetailApiDefinitionDto;
}

export class BaseProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsInt()
  @Min(1)
  @IsOptional()
  billingAccountId?: number | null;

  @ApiPropertyOptional({ nullable: true, type: [BookmarkDto] })
  @Type(() => BookmarkDto)
  @ValidateNested({ each: true })
  @IsOptional()
  bookmarks?: BookmarkDto[] | null;

  @ApiPropertyOptional({ nullable: true })
  @IsNumber()
  @IsOptional()
  estimatedPrice?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  terms?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groups?: string[];

  @ApiPropertyOptional({ nullable: true, type: ExternalDto })
  @Type(() => ExternalDto)
  @ValidateNested()
  @IsOptional()
  external?: ExternalDto | null;

  @ApiProperty()
  @IsString()
  @MaxLength(45)
  type: string;

  @ApiPropertyOptional({ type: ProjectDetailDto })
  @Type(() => ProjectDetailDto)
  @ValidateNested()
  @IsOptional()
  details: ProjectDetailDto;

  @ApiPropertyOptional({ nullable: true, type: [ChallengeEligibilityDto] })
  @Type(() => ChallengeEligibilityDto)
  @ValidateNested({ each: true })
  @IsOptional()
  challengeEligibility?: ChallengeEligibilityDto[] | null;

  @ApiPropertyOptional({})
  @IsString()
  @IsOptional()
  version?: string;
}

@ApiExtraModels(BaseProjectDto)
export class CreateProjectDto extends BaseProjectDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  @IsOptional()
  templateId?: number;

  @ApiPropertyOptional({ nullable: true, type: UtmDto })
  @Type(() => UtmDto)
  @ValidateNested()
  @IsOptional()
  utm?: UtmDto | null;

  @ApiPropertyOptional({ type: [EstimationDto] })
  @Type(() => EstimationDto)
  @ValidateNested({ each: true })
  @IsOptional()
  estimation?: EstimationDto[];

  @ApiPropertyOptional({ type: [AttachmentDto] })
  @Type(() => AttachmentDto)
  @ValidateNested({ each: true })
  @IsOptional()
  attachments?: AttachmentDto[];
}

@ApiExtraModels(BaseProjectDto)
export class UpdateProjectDto extends PartialType(BaseProjectDto) {
  @ApiPropertyOptional({ description: 'direct project id' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  directProjectId?: number;

  @ApiPropertyOptional({
    description: 'project status',
    enum: Object.values(PROJECT_STATUS),
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(PROJECT_STATUS))
  status?: string;

  @ApiPropertyOptional({
    description: 'Cancel reason. Required when status is cancelled.',
  })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}

@ApiExtraModels(
  CreateProjectDto,
  EstimationResponseDto,
  ProjectMemberResponseDto,
)
export class ProjectResponseDto extends OmitType(CreateProjectDto, [
  'estimation',
]) {
  @ApiProperty({ description: 'project id' })
  id: number;

  @ApiPropertyOptional({ description: 'direct project id' })
  directProjectId?: number;

  @ApiPropertyOptional({
    description: 'project status',
    enum: Object.values(PROJECT_STATUS),
  })
  status?: string;

  @ApiPropertyOptional({
    description: 'Cancel reason. Required when status is cancelled.',
  })
  cancelReason?: string;

  @ApiPropertyOptional({
    description: 'estimations',
    isArray: true,
    type: EstimationResponseDto,
  })
  estimation?: EstimationResponseDto[];

  @ApiPropertyOptional({
    description: 'Project members',
    isArray: true,
    type: ProjectMemberResponseDto,
  })
  members?: ProjectMemberResponseDto[];

  @ApiProperty({ example: '2025-01-29T15:04:26.096Z' })
  createdAt: string;

  @ApiProperty({ example: 22880988 })
  createdBy: number;

  @ApiProperty({ example: '2025-01-29T15:04:26.096Z' })
  updatedAt?: string | null;

  @ApiProperty({ example: 22880988 })
  updatedBy?: number | null;

  @ApiProperty({ example: '2025-01-29T15:04:26.096Z' })
  deletedAt?: string;

  @ApiProperty({ example: 22880988 })
  deletedBy?: number;
}

export class QueryProjectDto {
  @ApiPropertyOptional({ description: 'Can be a value or an array' })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  id?: string[];

  @ApiPropertyOptional({ description: 'project name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ description: 'direct Project Id' })
  @IsOptional()
  @IsNumberString()
  directProjectId?: string;

  @ApiPropertyOptional({ description: 'project utm.code' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ApiPropertyOptional({
    description: 'project customer first/last name or handle',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customer?: string;

  @ApiPropertyOptional({
    description: 'project manager first/last name or handle',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  manager?: string;

  @ApiPropertyOptional({
    description: 'project status',
    enum: Object.values(PROJECT_STATUS),
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsArray()
  // @IsIn(Object.values(PROJECT_STATUS), afterEach; true)
  @IsEnum(PROJECT_STATUS, { each: true })
  status?: string[];

  @ApiPropertyOptional({ description: 'project type' })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value ? [value] : [],
  )
  @IsArray()
  @IsString({ each: true })
  type?: string[];

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  keyword?: string;

  @ApiProperty({
    name: 'fields',
    description: 'the project fields',
    type: 'string',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  fields?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page: number = 1;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE })
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  perPage: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ example: 'name desc' })
  @IsOptional()
  @IsString()
  sort?: string;
}

export class ProjectCriteria {
  @ApiProperty({
    name: 'fields',
    description: 'the project fields',
    type: 'string',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  fields?: string;
}
