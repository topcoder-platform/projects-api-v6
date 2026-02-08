import { ApiProperty } from '@nestjs/swagger';

export class ProjectTypeResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  question: string;

  @ApiProperty()
  info: string;

  @ApiProperty({ type: [String] })
  aliases: unknown[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  metadata: Record<string, unknown>;

  @ApiProperty()
  disabled: boolean;

  @ApiProperty()
  hidden: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  createdBy: number;

  @ApiProperty()
  updatedBy: number;
}
