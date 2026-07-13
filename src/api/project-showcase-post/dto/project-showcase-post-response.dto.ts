import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectShowcasePostStatus } from '@prisma/client';
import { ProjectShowcasePostMediaDto } from './project-showcase-post-media.dto';
import { ChallengeMetadataDto } from './challenge-metadata.dto';

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

  @ApiPropertyOptional()
  projectTitle?: string;

  @ApiPropertyOptional({ type: [ProjectShowcasePostMediaDto] })
  media?: ProjectShowcasePostMediaDto[];

  @ApiPropertyOptional()
  publishedAt?: Date;

  @ApiPropertyOptional()
  publishedBy?: number;

  @ApiProperty()
  createdById: number;

  @ApiProperty()
  updatedById: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [ChallengeMetadataDto] })
  challengeMetadata?: ChallengeMetadataDto[];
}
