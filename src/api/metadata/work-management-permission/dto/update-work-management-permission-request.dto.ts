import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { UpdateWorkManagementPermissionDto } from './update-work-management-permission.dto';

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
