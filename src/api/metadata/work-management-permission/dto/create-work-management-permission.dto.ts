import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsObject, IsString, Min } from 'class-validator';

/**
 * Request payload for creating a work management permission record.
 *
 * @property policy Policy identifier.
 * @property permission Permission payload object.
 * @property projectTemplateId Project template id.
 */
export class CreateWorkManagementPermissionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  policy: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  permission: Record<string, unknown>;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectTemplateId: number;
}
