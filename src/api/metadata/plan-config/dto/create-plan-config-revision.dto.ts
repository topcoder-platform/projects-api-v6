import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class CreatePlanConfigRevisionDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'PlanConfig configuration JSON payload.',
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;
}
