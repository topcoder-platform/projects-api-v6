import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ProjectShowcasePostMediaInputDto {
  @ApiProperty({ description: 'MIME type of the media asset.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'URL of the media asset.' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'Alternative text for the media asset.' })
  @IsOptional()
  @IsString()
  alt?: string;
}
