import { InviteStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateInviteDto {
  @ApiProperty({ enum: InviteStatus, enumName: 'InviteStatus' })
  @IsEnum(InviteStatus)
  status: InviteStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}
