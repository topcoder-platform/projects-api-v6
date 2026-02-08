import { ApiProperty } from '@nestjs/swagger';

export class WorkManagementPermissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  policy: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  permission: Record<string, unknown>;

  @ApiProperty()
  projectTemplateId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
