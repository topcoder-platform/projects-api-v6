import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class CreatePriceConfigRevisionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'PriceConfig configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
