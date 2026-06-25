import { ApiProperty } from '@nestjs/swagger';

export class ProjectPostIndustryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}
