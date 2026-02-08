import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

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
