import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Admin-only request DTO for `POST /projects/:projectId/upgrade`.
 *
 * Only `targetVersion: 'v3'` is currently supported by the service layer.
 */
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

  /**
   * @todo `phaseName` is currently not consumed by `ProjectService.upgradeProject`
   * and should be removed or implemented.
   */
  @ApiPropertyOptional({ description: 'Optional phase name for future use.' })
  @IsOptional()
  @IsString()
  phaseName?: string;
}
