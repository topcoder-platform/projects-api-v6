/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsPositive,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';
import { ATTACHMENT_TYPES } from 'src/shared/constants';

export class CreateAttachmentDto {
  @ApiProperty({
    description: 'Title of the attachment',
    example: 'Project Document',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the attachment',
    example: 'Important project document',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Category of the attachment',
    example: 'document',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  category?: string | null;

  @ApiPropertyOptional({
    description: 'Size of the attachment in bytes',
    example: 1024,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  size?: number;

  @ApiProperty({
    description: 'Path to the attachment',
    example: '/documents/project.pdf',
  })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({
    description: 'Type of the attachment',
    example: ATTACHMENT_TYPES.FILE,
    enum: Object.values(ATTACHMENT_TYPES),
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(Object.values(ATTACHMENT_TYPES))
  type: string;

  @ApiPropertyOptional({
    description: 'Tags associated with the attachment',
    example: ['important', 'project'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'S3 bucket name (required when type is FILE)',
    example: 'my-bucket',
  })
  @ValidateIf((o) => o.type === ATTACHMENT_TYPES.FILE)
  @IsString()
  @IsNotEmpty()
  s3Bucket?: string;

  @ApiPropertyOptional({
    description: 'Content type (required when type is FILE)',
    example: 'application/pdf',
  })
  @ValidateIf((o) => o.type === ATTACHMENT_TYPES.FILE)
  @IsString()
  @IsNotEmpty()
  contentType?: string;

  @ApiPropertyOptional({
    description: 'Array of user IDs who are allowed to access this attachment',
    example: [1, 2, 3],
    type: [Number],
    nullable: true,
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsPositive({ each: true })
  @IsOptional()
  allowedUsers?: number[] | null;
}

export class AttachmentResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the attachment',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The ID of the associated project',
    example: 123,
  })
  projectId: number;

  @ApiProperty({
    description: 'Type of the attachment',
    example: 'link',
    enum: Object.values(ATTACHMENT_TYPES),
  })
  type: string;

  @ApiPropertyOptional({
    description: 'Tags associated with the attachment',
    example: ['important', 'document'],
    type: [String],
    nullable: true,
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Array of user IDs who are allowed to access this attachment',
    example: [1, 2, 3],
    type: [Number],
    nullable: true,
  })
  allowedUsers?: number[];

  @ApiProperty({
    description: 'Path or location of the attachment',
    example: '/documents/project.pdf',
  })
  path: string;

  @ApiPropertyOptional({
    description: 'Size of the attachment in bytes',
    example: 1024,
    nullable: true,
  })
  size?: number | null;

  @ApiPropertyOptional({
    description: 'Category of the attachment',
    example: 'document',
    nullable: true,
  })
  category?: string | null;

  @ApiPropertyOptional({
    description: 'Content type of the attachment',
    example: 'application/pdf',
    nullable: true,
  })
  contentType?: string | null;

  @ApiProperty({
    description: 'Title of the attachment',
    example: 'Project Documentation',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the attachment',
    example: 'Important project documentation',
    nullable: true,
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'URL for link-type attachments',
    example: 'https://example.com/document',
    nullable: true,
  })
  url?: string | null;

  @ApiProperty({
    description: 'Timestamp when the attachment was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'ID of the user who created the attachment',
    example: 456,
  })
  createdBy: number;

  @ApiProperty({
    description: 'Timestamp when the attachment was last updated',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt?: string | null;

  @ApiProperty({
    description: 'ID of the user who last updated the attachment',
    example: 456,
  })
  updatedBy?: number | null;
}

export class UpdateAttachmentDto {
  @ApiProperty({
    description: 'Title of the resource',
    example: 'Project Documentation',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the resource',
    example: 'Detailed project documentation',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.description !== null)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Array of user IDs with access permission',
    example: [1, 2, 3],
    type: [Number],
    nullable: true,
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsPositive({ each: true })
  @IsOptional()
  allowedUsers?: number[] | null;

  @ApiPropertyOptional({
    description: 'Tags associated with the resource',
    example: ['important', 'project'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Path to the resource',
    example: '/documents/project.pdf',
  })
  @IsString()
  path: string;
}
