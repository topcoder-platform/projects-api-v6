import { ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhaseProductResponseDto } from 'src/api/phase-product/dto/phase-product-response.dto';

/**
 * Response model for phase member rows embedded in phase responses.
 */
export class ProjectPhaseMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phaseId: string;

  @ApiProperty()
  userId: string;

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
 * Response model for phase approval rows embedded in phase responses.
 */
export class ProjectPhaseApprovalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phaseId: string;

  @ApiProperty()
  decision: string;

  @ApiPropertyOptional()
  comment?: string | null;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional()
  endDate?: Date | null;

  @ApiProperty()
  expectedEndDate: Date;

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
 * Response payload for phase/work endpoints. Relation arrays are included only
 * when requested via the `fields` query parameter (`products`, `members`,
 * `approvals`, or `all`).
 */
export class PhaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  requirements?: string | null;

  @ApiPropertyOptional({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
  })
  status?: ProjectStatus | null;

  @ApiPropertyOptional()
  startDate?: Date | null;

  @ApiPropertyOptional()
  endDate?: Date | null;

  @ApiPropertyOptional()
  duration?: number | null;

  @ApiProperty()
  budget: number;

  @ApiProperty()
  spentBudget: number;

  @ApiProperty()
  progress: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  details: Record<string, unknown>;

  @ApiPropertyOptional()
  order?: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;

  @ApiPropertyOptional({
    type: () => [PhaseProductResponseDto],
    description:
      'Conditionally populated when `fields` includes `products` (or `all`).',
  })
  products?: PhaseProductResponseDto[];

  @ApiPropertyOptional({
    type: () => [ProjectPhaseMemberDto],
    description:
      'Conditionally populated when `fields` includes `members` (or `all`).',
  })
  members?: ProjectPhaseMemberDto[];

  @ApiPropertyOptional({
    type: () => [ProjectPhaseApprovalDto],
    description:
      'Conditionally populated when `fields` includes `approvals` (or `all`).',
  })
  approvals?: ProjectPhaseApprovalDto[];
}
