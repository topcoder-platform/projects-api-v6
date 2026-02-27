import { InviteStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * DTO for invite status updates.
 *
 * `source` currently supports `work_manager` and `copilot_portal`, which
 * influence copilot application workflow transitions.
 */
export class UpdateInviteDto {
  @ApiProperty({ enum: InviteStatus, enumName: 'InviteStatus' })
  @IsEnum(InviteStatus)
  status: InviteStatus;

  @ApiPropertyOptional()
  // TODO: SECURITY: `source` is free-form but drives workflow state changes.
  // Validate with enum or `@IsIn(['work_manager', 'copilot_portal'])`.
  @IsOptional()
  @IsString()
  source?: string;
}
