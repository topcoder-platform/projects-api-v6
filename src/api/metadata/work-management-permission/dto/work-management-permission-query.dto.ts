import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

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
