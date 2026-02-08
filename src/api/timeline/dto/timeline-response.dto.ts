import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimelineReference } from '@prisma/client';
import { MilestoneResponseDto } from 'src/api/milestone/dto/milestone-response.dto';

export class TimelineResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty()
  startDate: Date;

  @ApiPropertyOptional({ nullable: true })
  endDate?: Date | null;

  @ApiProperty({
    enum: TimelineReference,
    enumName: 'TimelineReference',
  })
  reference: TimelineReference;

  @ApiProperty()
  referenceId: string;

  @ApiPropertyOptional({ type: () => [MilestoneResponseDto] })
  milestones?: MilestoneResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
