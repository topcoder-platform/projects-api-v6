import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ProjectShowcasePostStatus } from '@prisma/client';
import { ProjectShowcasePostMediaInputDto } from './project-showcase-post-media-input.dto';

import { ShowcaseMetadataDto } from './showcase-metadata.dto';
import { SHOWCASE_TYPES } from 'src/shared/utils/showcase-metadata.utils';

/** Creates a showcase post with a delivery type and required shared project metadata. */
export class CreateProjectShowcasePostDto extends ShowcaseMetadataDto {
  @ApiProperty({ enum: SHOWCASE_TYPES })
  @IsIn(SHOWCASE_TYPES)
  type: string;

  @ApiProperty({ description: 'Post title.' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'The Solution; retains the existing rich text content format.',
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ enum: ProjectShowcasePostStatus })
  @IsOptional()
  @IsEnum(ProjectShowcasePostStatus)
  status?: ProjectShowcasePostStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  challengeIds?: string[];

  @ApiPropertyOptional({ type: [ProjectShowcasePostMediaInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectShowcasePostMediaInputDto)
  media?: ProjectShowcasePostMediaInputDto[];
}
