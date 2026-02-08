import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateMilestoneTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  plannedText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activeText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  completedText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  blockedText: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  referenceId: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;
}
