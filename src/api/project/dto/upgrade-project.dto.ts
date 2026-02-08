import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpgradeProjectDto {
  @ApiProperty({ description: 'Target project version, for example v3.' })
  @IsString()
  targetVersion: string;

  @ApiPropertyOptional({
    description: 'Optional project template id to assign during upgrade.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultProductTemplateId?: number;

  @ApiPropertyOptional({ description: 'Optional phase name for future use.' })
  @IsOptional()
  @IsString()
  phaseName?: string;
}
