import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/**
 * Filter criteria payload for listing work management permissions.
 *
 * @property projectTemplateId Project template id filter.
 */
export class WorkManagementPermissionCriteriaDto {
  @ApiProperty({
    description: 'Project template id used to filter permission metadata.',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectTemplateId: number;
}
