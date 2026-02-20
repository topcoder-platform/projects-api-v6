import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Query payload for list-or-get permission requests.
 *
 * @property id Optional permission id for single-record mode.
 * @property projectTemplateId Optional project template id for list mode.
 */
export class WorkManagementPermissionQueryDto {
  @ApiPropertyOptional({
    description:
      'Work management permission id. When provided, returns one record.',
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({
    description:
      'Project template id used to filter permission metadata when id is not provided.',
    minimum: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  projectTemplateId?: number;
}
