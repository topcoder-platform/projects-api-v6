import { ApiProperty } from '@nestjs/swagger';

export class ChallengeMetadataDto {
  @ApiProperty()
  challengeId: string;

  @ApiProperty()
  numOfSubmissions: number;

  @ApiProperty()
  numOfRegistrants: number;

  @ApiProperty({ type: [Object] })
  skills: Array<{ id: string; name: string }>;

  @ApiProperty()
  track: string;

  @ApiProperty({ type: [String] })
  countries: string[];
}
