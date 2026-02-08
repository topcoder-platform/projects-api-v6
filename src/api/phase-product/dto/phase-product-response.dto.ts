import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PhaseProductResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  phaseId: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  directProjectId?: string | null;

  @ApiPropertyOptional()
  billingAccountId?: string | null;

  @ApiProperty()
  templateId: string;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  type?: string | null;

  @ApiProperty()
  estimatedPrice: number;

  @ApiProperty()
  actualPrice: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  details: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
