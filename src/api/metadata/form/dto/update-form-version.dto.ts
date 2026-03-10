import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for updating the latest revision within a form version.
 *
 * @property config Replacement form JSON configuration body.
 */
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
