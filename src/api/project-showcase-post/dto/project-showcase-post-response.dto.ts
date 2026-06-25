import { ApiProperty } from '@nestjs/swagger';

export class ProjectShowcasePostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty({ type: [String] })
  challengeIds: string[];

  @ApiProperty({ type: [Object] })
  industries: Array<{ id: string; name: string }>;

  @ApiProperty({ type: [Object] })
  categories: Array<{ id: string; name: string }>;

  @ApiProperty()
  createdById: number;

  @ApiProperty()
  updatedById: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
