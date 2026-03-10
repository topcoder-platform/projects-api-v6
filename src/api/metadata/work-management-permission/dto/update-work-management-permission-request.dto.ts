import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { UpdateWorkManagementPermissionDto } from './update-work-management-permission.dto';

/**
 * Request payload for updating a work management permission by id.
 *
 * @property id Permission record id.
 * @property policy Optional policy override.
 * @property permission Optional permission payload override.
 * @property projectTemplateId Optional project template id override.
 */
export class UpdateWorkManagementPermissionRequestDto extends UpdateWorkManagementPermissionDto {
  @ApiProperty({
    description: 'Work management permission id.',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;
}
