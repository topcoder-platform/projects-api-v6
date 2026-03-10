import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for creating a new form revision.
 *
 * @property config Form JSON configuration body.
 */
export class CreateFormRevisionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Form configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
