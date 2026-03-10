import { AttachmentType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response payload for project attachment endpoints.
 */
export class AttachmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty({
    enum: AttachmentType,
    enumName: 'AttachmentType',
  })
  type: AttachmentType;

  @ApiProperty({ maxLength: 2048 })
  path: string;

  @ApiPropertyOptional()
  size?: number | null;

  @ApiPropertyOptional()
  category?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  contentType?: string | null;

  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @ApiPropertyOptional({ type: [Number] })
  allowedUsers?: number[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: number;

  @ApiPropertyOptional({
    description:
      'Presigned URL for file download on single fetch endpoint (single-fetch use).',
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Presigned URL returned on file attachment create responses.',
  })
  downloadUrl?: string;
}
