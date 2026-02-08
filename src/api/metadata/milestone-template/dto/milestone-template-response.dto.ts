import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MilestoneTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  type: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  plannedText: string;

  @ApiProperty()
  activeText: string;

  @ApiProperty()
  completedText: string;

  @ApiProperty()
  blockedText: string;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  referenceId: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
