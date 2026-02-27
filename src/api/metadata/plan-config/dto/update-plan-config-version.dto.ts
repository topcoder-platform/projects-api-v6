import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for updating the latest revision of a plan config version.
 *
 * @property config Replacement plan config JSON payload.
 */
export class UpdatePlanConfigVersionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'PlanConfig configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
