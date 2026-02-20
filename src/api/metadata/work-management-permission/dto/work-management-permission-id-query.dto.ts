import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/**
 * Query payload for addressing one permission by id.
 *
 * @property id Permission id.
 */
export class WorkManagementPermissionIdQueryDto {
  @ApiProperty({
    description: 'Work management permission id.',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;
}
