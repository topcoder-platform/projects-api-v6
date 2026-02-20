import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { parseOptionalIntegerArray } from 'src/shared/utils/dto-transform.utils';

/**
 * Update payload for `PATCH /projects/:projectId/attachments/:id`.
 * `type` and `contentType` are immutable after creation and intentionally
 * excluded from this DTO.
 */
export class UpdateAttachmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => parseOptionalIntegerArray(value))
  @IsInt({ each: true })
  allowedUsers?: number[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  path?: string;
}
