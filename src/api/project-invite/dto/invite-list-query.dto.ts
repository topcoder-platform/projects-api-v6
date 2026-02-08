import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class InviteListQueryDto {
  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}

export class GetInviteQueryDto {
  @ApiPropertyOptional({
    description: 'CSV of additional user fields. Example: handle,email',
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
