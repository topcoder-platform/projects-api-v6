import { ApiProperty } from '@nestjs/swagger';
import { ProjectShowcasePostStatus } from '@prisma/client';

export class ProjectShowcasePostResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ProjectShowcasePostStatus })
  status: ProjectShowcasePostStatus;

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
