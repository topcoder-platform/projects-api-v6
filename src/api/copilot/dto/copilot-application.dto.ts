import { CopilotApplicationStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTOs for copilot applications (apply, list, assign).
 */
function parseOptionalInteger(value: unknown): number | undefined {
  // TODO [DRY]: parseOptionalInteger is duplicated verbatim in copilot-request.dto.ts and copilot-opportunity.dto.ts; extract shared dto transform utilities.
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

/**
 * Request body for applying to an opportunity.
 * notes is required.
 */
export class CreateCopilotApplicationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  notes: string;
}

/**
 * Embedded membership context when applicant is already in the project.
 */
export class ExistingMembershipDto {
  @ApiProperty()
  role: string;
}

/**
 * Full copilot application response.
 * existingMembership is only populated in admin/PM list views.
 */
export class CopilotApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  opportunityId: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({
    enum: CopilotApplicationStatus,
    enumName: 'CopilotApplicationStatus',
  })
  status: CopilotApplicationStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => ExistingMembershipDto })
  existingMembership?: ExistingMembershipDto;
}

/**
 * Request body for assigning a copilot application.
 */
export class AssignCopilotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  applicationId: string;
}

/**
 * Pagination and sort query parameters for application listing endpoints.
 */
export class CopilotApplicationListQueryDto {
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
}
