import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class ProjectShowcasePostMediaDto {
  @ApiProperty({ description: 'Media asset id.' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'MIME type of the media asset.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'URL of the media asset.' })
  @IsUrl()
  url: string;

  @ApiProperty({ description: 'Timestamp when media asset was created.' })
  createdAt: Date;

  @ApiProperty({ description: 'User id who created the media asset.' })
  createdBy: string;
}
