import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for creating a new price config revision.
 *
 * @property config Price config JSON payload.
 */
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
