import { Controller, Get, Header, Param } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MANAGER_ROLES, UserRole } from 'src/shared/enums/userRole.enum';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { SalesforceOpportunityResponseDto } from './dto/salesforce-opportunity-response.dto';
import { SalesforceOpportunityService } from './salesforce-opportunity.service';

/**
 * Roles allowed to read Salesforce opportunity details.
 *
 * Manager-tier roles cover the Work app users who edit project details;
 * talent-manager roles cover the Sales app opportunity listing.
 */
const OPPORTUNITY_ROLES = [
  ...MANAGER_ROLES,
  UserRole.TALENT_MANAGER,
  UserRole.TOPCODER_TALENT_MANAGER,
];

/**
 * Read-only Salesforce opportunity endpoints.
 *
 * Used by the Work app to populate project details from an opportunity, and by
 * the Sales app to show an opportunity description. Responses are never cached
 * by intermediaries because Salesforce remains the source of truth.
 */
@ApiTags('Salesforce')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
@ApiForbiddenResponse({
  description: 'Requires a manager-tier or talent-manager role.',
})
@Controller('/projects/salesforce/opportunities')
export class SalesforceOpportunityController {
  /**
   * @param opportunities Read-only Salesforce opportunity service.
   */
  constructor(private readonly opportunities: SalesforceOpportunityService) {}

  /**
   * Returns a single Salesforce opportunity by record id.
   *
   * @param opportunityId 15 or 18 character Salesforce opportunity id
   * @returns the opportunity attributes used by Work and Sales
   */
  @Get(':opportunityId')
  @Roles(...OPPORTUNITY_ROLES)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Get a Salesforce opportunity',
    description:
      'Reads Subcontracting End Customer, Reporting SMU, Close Date and Description for an opportunity. Read-only; nothing is written back to Salesforce.',
  })
  @ApiParam({
    name: 'opportunityId',
    description: 'Salesforce opportunity record id (15 or 18 characters).',
    example: '006UN00000XamntYAB',
  })
  @ApiOkResponse({ type: SalesforceOpportunityResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed opportunity id.' })
  @ApiNotFoundResponse({ description: 'No opportunity exists for that ID.' })
  @ApiBadGatewayResponse({
    description: 'Salesforce is unavailable or returned an invalid response.',
  })
  @ApiServiceUnavailableResponse({
    description: 'Server Salesforce configuration is missing or invalid.',
  })
  async getOpportunity(
    @Param('opportunityId') opportunityId: string,
  ): Promise<SalesforceOpportunityResponseDto> {
    return this.opportunities.getOpportunity(opportunityId);
  }
}
