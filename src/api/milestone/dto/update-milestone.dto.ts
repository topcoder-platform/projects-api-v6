import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateMilestoneDto } from './create-milestone.dto';

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {
  @ApiPropertyOptional({
    description:
      'Optional comment stored in milestone status history when status changes.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  statusComment?: string;
}
