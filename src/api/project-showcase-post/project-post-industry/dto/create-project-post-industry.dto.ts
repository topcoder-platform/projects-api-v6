import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProjectPostIndustryDto {
  @ApiProperty({ description: 'Industry name' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
