import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for updating the latest revision of a price config version.
 *
 * @property config Replacement price config JSON payload.
 */
export class UpdatePriceConfigVersionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'PriceConfig configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
