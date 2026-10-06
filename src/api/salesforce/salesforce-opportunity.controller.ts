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
 * the Sales app to show opportunity details and project billing history. Responses are never cached
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
   * Returns a Salesforce opportunity with its current account and project history.
   *
   * @param opportunityId 15 or 18 character Salesforce opportunity id
   * @returns Opportunity attributes, current account, project ID, and related accounts.
   * @throws Propagates validation, not-found, configuration, and upstream errors from the service.
   */
  @Get(':opportunityId')
  @Roles(...OPPORTUNITY_ROLES)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Get a Salesforce opportunity',
    description:
      'Reads opportunity details, the local billing account and matching project, and unique billing accounts used by the project challenges. Read-only; nothing is written back to Salesforce.',
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
    description:
      'Salesforce, billing accounts, or project billing history could not be loaded.',
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
