import { ProjectStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusHistoryResponseDto } from './status-history-response.dto';

export class MilestoneResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timelineId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  duration: number;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional({ nullable: true })
  actualStartDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  endDate?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  completionDate?: Date | null;

  @ApiProperty({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
  })
  status: ProjectStatus;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  details?: Record<string, unknown> | null;

  @ApiProperty()
  order: number;

  @ApiPropertyOptional({ nullable: true })
  plannedText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  activeText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  blockedText?: string | null;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty({ type: () => [StatusHistoryResponseDto] })
  statusHistory: StatusHistoryResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
