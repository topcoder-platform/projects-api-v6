import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Salesforce opportunity fields used to populate project details.
 *
 * Only read-only, non-sensitive opportunity attributes are exposed. The
 * `smu`/`smuOther` pair is already mapped onto the SMU options accepted by
 * `Project.details`, so the client can apply it without translation.
 */
export class SalesforceOpportunityResponseDto {
  @ApiProperty({
    description: 'Salesforce opportunity record id (18 characters).',
    example: '006UN00000XamntYAB',
  })
  id: string;

  @ApiProperty({
    description: 'Opportunity name.',
    example: 'EMEA - Amazon Web Services - PS BFSI',
  })
  name: string;

  @ApiPropertyOptional({
    description:
      'Opportunity description, shown in the Sales opportunity popup.',
  })
  description?: string;

  @ApiPropertyOptional({
    description:
      'Subcontracting End Customer account name; maps to the project Customer field.',
    example: 'Novartis Pharmaceuticals',
  })
  customer?: string;

  @ApiPropertyOptional({
    description:
      'Reporting SMU mapped to a supported project SMU option, or "Others" when unrecognized.',
    example: 'AMR1',
  })
  smu?: string;

  @ApiPropertyOptional({
    description:
      'Raw Reporting SMU value, populated only when `smu` is "Others".',
    example: 'INTERNAL',
  })
  smuOther?: string;

  @ApiPropertyOptional({
    description: 'Raw Salesforce Reporting SMU value.',
    example: 'AMR1',
  })
  reportingSmu?: string;

  @ApiPropertyOptional({
    description: 'Close Date as a YYYY-MM-DD calendar date.',
    example: '2026-07-31',
  })
  closeDate?: string;

  @ApiPropertyOptional({ description: 'Opportunity stage name.' })
  stageName?: string;

  @ApiProperty({
    description: 'Deep link to the opportunity record in Salesforce.',
    example: 'https://topcoder.my.salesforce.com/006UN00000XamntYAB',
  })
  url: string;
}
