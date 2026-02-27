import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * Versioned metadata reference payload.
 *
 * @property key Metadata key to resolve.
 * @property version Optional metadata version. When omitted, callers resolve to
 * latest.
 */
export class MetadataReferenceDto {
  @ApiProperty({ example: 'design' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiPropertyOptional({ example: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
