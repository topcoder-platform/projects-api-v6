import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for creating a new price config version.
 *
 * @property config Price config JSON payload.
 */
export class CreatePriceConfigVersionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'PriceConfig configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
