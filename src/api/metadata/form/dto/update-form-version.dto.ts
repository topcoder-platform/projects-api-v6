import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class UpdateFormVersionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Form configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
