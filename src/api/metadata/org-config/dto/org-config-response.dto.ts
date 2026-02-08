import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrgConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orgId: string;

  @ApiProperty()
  configName: string;

  @ApiPropertyOptional()
  configValue?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
