import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class MilestoneListQueryDto {
  @ApiPropertyOptional({
    description: 'Sort by order. Allowed values: order asc, order desc.',
    default: 'order asc',
  })
  @IsOptional()
  @IsIn(['order asc', 'order desc'])
  sort?: 'order asc' | 'order desc';
}
