import { ApiProperty } from '@nestjs/swagger';

export class ProjectPostCategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}
