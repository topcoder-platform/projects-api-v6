import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CloneMilestoneTemplateDto {
  @ApiProperty({ description: 'Source milestone template id to clone.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceMilestoneTemplateId: number;

  @ApiPropertyOptional({
    description: 'Optional reference override for cloned template.',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Optional reference id override for cloned template.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  referenceId?: number;
}
