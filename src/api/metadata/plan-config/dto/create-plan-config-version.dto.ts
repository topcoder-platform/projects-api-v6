import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

/**
 * Request payload for creating a new plan config version.
 *
 * @property config Plan config JSON payload.
 */
export class CreatePlanConfigVersionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'PlanConfig configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
