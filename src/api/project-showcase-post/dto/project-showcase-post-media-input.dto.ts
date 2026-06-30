import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class ProjectShowcasePostMediaInputDto {
  @ApiProperty({ description: 'MIME type of the media asset.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'URL of the media asset.' })
  @IsUrl()
  url: string;
}
