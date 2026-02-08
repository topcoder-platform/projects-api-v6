import { ApiProperty } from '@nestjs/swagger';

export class PriceConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  revision: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  config: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
