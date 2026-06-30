import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ProjectShowcasePostStatus } from '@prisma/client';
import { ProjectShowcasePostMediaInputDto } from './project-showcase-post-media-input.dto';

export class CreateProjectShowcasePostDto {
  @ApiProperty({ description: 'Post title.' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Post content.' })
  @IsString()
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
