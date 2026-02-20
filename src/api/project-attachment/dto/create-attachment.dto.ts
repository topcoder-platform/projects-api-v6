import { AttachmentType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

function parseOptionalInteger(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.trunc(parsed);
}
// TODO [DRY]: Duplicated in `update-attachment.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

function parseAllowedUsers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === 'number');
}
// TODO [DRY]: Duplicated in `update-attachment.dto.ts`; extract to `src/shared/utils/dto-transform.utils.ts`.

/**
 * Create payload for project attachment endpoints:
 * `POST /projects/:projectId/attachments`.
 */
export class CreateAttachmentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsNumber()
  size?: number;

  @ApiProperty({ maxLength: 2048 })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({
    enum: AttachmentType,
    enumName: 'AttachmentType',
  })
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description:
      'Required for file attachments. Source S3 bucket for transfer; not stored in attachment row.',
  })
  @ValidateIf(
    (value: CreateAttachmentDto) => value.type === AttachmentType.file,
  )
  @IsString()
  @IsNotEmpty()
  // TODO [SECURITY]: Validate `s3Bucket` against an allowlist before using it as transfer source.
  s3Bucket?: string;

  @ApiPropertyOptional({
    description: 'Required for file attachments',
  })
  @ValidateIf(
    (value: CreateAttachmentDto) => value.type === AttachmentType.file,
  )
  @IsString()
  @IsNotEmpty()
  contentType?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => parseAllowedUsers(value))
  @IsInt({ each: true })
  allowedUsers?: number[];
}
