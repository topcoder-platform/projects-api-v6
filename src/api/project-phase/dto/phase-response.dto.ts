import { ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhaseProductResponseDto } from 'src/api/phase-product/dto/phase-product-response.dto';

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

  @ApiPropertyOptional({ type: () => [PhaseProductResponseDto] })
  products?: PhaseProductResponseDto[];

  @ApiPropertyOptional({ type: () => [ProjectPhaseMemberDto] })
  members?: ProjectPhaseMemberDto[];

  @ApiPropertyOptional({ type: () => [ProjectPhaseApprovalDto] })
  approvals?: ProjectPhaseApprovalDto[];
}
