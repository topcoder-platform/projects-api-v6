import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Request payload for creating an org config entry.
 *
 * @property orgId Organization id.
 * @property configName Config key name.
 * @property configValue Optional config value.
 */
export class CreateOrgConfigDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orgId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  configName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  configValue?: string;
}
