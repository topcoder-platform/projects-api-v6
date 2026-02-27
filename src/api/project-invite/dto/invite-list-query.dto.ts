import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Query DTO for listing project invites.
 */
export class InviteListQueryDto {
  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}

/**
 * Query DTO for getting a single project invite.
 */
export class GetInviteQueryDto {
  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
