import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SHOWCASE_CURRENT_STATUSES } from 'src/shared/utils/showcase-metadata.utils';

/**
 * Additional showcase input, inherited by create/update DTOs. Shared project
 * fields are validated against current Project.details in the save transaction.
 */
export class ShowcaseMetadataDto {
  @ApiPropertyOptional({
    description: 'Customer; saved to project.details.customer.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  customer?: string;

  @ApiPropertyOptional({ description: 'SMU; saved to project.details.smu.' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  smu?: string;

  @ApiPropertyOptional({
    description: 'Required for Others; saved to project.details.smuOther.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  smuOther?: string;

  @ApiPropertyOptional({
    description: 'YYYY-MM-DD; saved to project.details.dealCloseDate.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  dealCloseDate?: string;

  @ApiPropertyOptional({
    description: 'The Challenge; same rich text format as content.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  challenge?: string;

  @ApiPropertyOptional({
    description: 'Business Impact Realised; same rich text format as content.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  businessImpact?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  keyWin?: string;

  @ApiPropertyOptional({ enum: SHOWCASE_CURRENT_STATUSES })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn([...SHOWCASE_CURRENT_STATUSES, ''])
  currentStatus?: string;

  @ApiPropertyOptional({ description: 'Owner name or handle.' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  owner?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Opt in to the authenticated WIN report.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  sendToWin?: boolean;
}
