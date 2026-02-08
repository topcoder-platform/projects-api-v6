import { ApiProperty } from '@nestjs/swagger';
import { TimelineReference } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';

function parseInteger(value: unknown): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
}

export class TimelineListQueryDto {
  @ApiProperty({
    enum: TimelineReference,
    enumName: 'TimelineReference',
    description: 'Timeline parent reference type.',
  })
  @IsEnum(TimelineReference)
  reference: TimelineReference;

  @ApiProperty({
    description: 'Timeline parent reference id.',
    minimum: 1,
  })
  @Transform(({ value }) => parseInteger(value))
  @IsInt()
  @Min(1)
  referenceId: number;
}
