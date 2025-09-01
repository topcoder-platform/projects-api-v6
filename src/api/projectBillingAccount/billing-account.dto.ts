import { ApiProperty } from '@nestjs/swagger';

export class BillingAccountResponseDto {
  @ApiProperty({
    name: 'tcBillingAccountId',
    description: 'TopCoder billing account id',
  })
  tcBillingAccountId: number | null;
  @ApiProperty({ name: 'markup', description: 'Billing account markup' })
  markup: number | null;
  @ApiProperty({ name: 'active', description: 'Billing account status' })
  active: boolean | null;
  @ApiProperty({ name: 'startDate', description: 'Billing account start date' })
  startDate: string | null;
  @ApiProperty({ name: 'endDate', description: 'Billing account end date' })
  endDate: string | null;
}

export class ListBillingAccountItem {
  @ApiProperty({
    name: 'sfBillingAccountId',
    description: 'Salesforce billing account id',
  })
  sfBillingAccountId: string | null;
  @ApiProperty({
    name: 'tcBillingAccountId',
    description: 'TopCoder billing account id',
  })
  tcBillingAccountId: number | null;
  @ApiProperty({ name: 'name', description: 'Billing account name' })
  name: number | null;
  @ApiProperty({ name: 'startDate', description: 'Billing account start date' })
  startDate: string | null;
  @ApiProperty({ name: 'endDate', description: 'Billing account end date' })
  endDate: string | null;
}
