import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SALESFORCE_OPPORTUNITY_ID_PATTERN,
  SMU_VALUES,
  normalizeSmuValue,
} from 'src/shared/utils/showcase-metadata.utils';
import { SalesforceOpportunityResponseDto } from './dto/salesforce-opportunity-response.dto';
import { SalesforceClient } from './salesforce.client';

/**
 * Salesforce opportunity record shape returned by the SOQL projection below.
 */
interface OpportunityRecord {
  Id?: unknown;
  Name?: unknown;
  Description?: unknown;
  CloseDate?: unknown;
  StageName?: unknown;
  Reporting_SMU__c?: unknown;
  Subcontracting_End_Customer__r?: { Name?: unknown } | null;
}

/**
 * Fields read from `Opportunity` for the Work and Sales integrations.
 *
 * Only the attributes listed in PM-6363 are projected, so no additional
 * Salesforce data reaches the API surface.
 */
const OPPORTUNITY_FIELDS = [
  'Id',
  'Name',
  'Description',
  'CloseDate',
  'StageName',
  'Reporting_SMU__c',
  'Subcontracting_End_Customer__r.Name',
].join(',');

/**
 * Read-only Salesforce opportunity lookups.
 *
 * Backs the Work app's project-detail auto-population and the Sales app's
 * opportunity description popup. Nothing is written back to Salesforce.
 */
@Injectable()
export class SalesforceOpportunityService {
  /**
   * @param client Shared read-only Salesforce REST client.
   */
  constructor(private readonly client: SalesforceClient) {}

  /**
   * Reads a string field, trimming it and discarding empty values.
   *
   * @param value raw Salesforce field value
   * @returns the trimmed string, or `undefined` when absent or blank
   */
  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  /**
   * Maps a Salesforce Reporting SMU onto the SMU options accepted by
   * `Project.details`.
   *
   * Unrecognized codes (for example `INTERNAL`) are surfaced as `Others` with
   * the raw value in `smuOther`, so nothing is silently dropped.
   *
   * @param reportingSmu raw `Reporting_SMU__c` value
   * @returns the mapped option pair, or an empty object when unset
   */
  private mapSmu(reportingSmu: string | undefined): {
    smu?: string;
    smuOther?: string;
  } {
    if (!reportingSmu) {
      return {};
    }

    const normalized = normalizeSmuValue(reportingSmu);
    if (SMU_VALUES.includes(normalized) && normalized !== 'Others') {
      return { smu: normalized };
    }

    return { smu: 'Others', smuOther: reportingSmu.slice(0, 255) };
  }

  /**
   * Retrieves a single opportunity by record id.
   *
   * @param opportunityId 15 or 18 character Salesforce opportunity id
   * @returns the opportunity attributes used by Work and Sales
   * @throws BadRequestException for a malformed id; NotFoundException when no
   * opportunity is visible to the integration user; ServiceUnavailableException
   * or BadGatewayException for configuration and upstream failures
   */
  async getOpportunity(
    opportunityId: string,
  ): Promise<SalesforceOpportunityResponseDto> {
    const id = (opportunityId || '').trim();
    if (!SALESFORCE_OPPORTUNITY_ID_PATTERN.test(id)) {
      throw new BadRequestException(
        'Enter a valid 15 or 18 character Salesforce opportunity id.',
      );
    }

    // SECURITY: `id` is constrained to [A-Za-z0-9] by the pattern above, so it
    // cannot terminate the quoted SOQL literal.
    const records = await this.client.query<OpportunityRecord>(
      `SELECT ${OPPORTUNITY_FIELDS} FROM Opportunity WHERE Id = '${id}' LIMIT 1`,
    );

    const record = records[0];
    if (!record) {
      throw new NotFoundException(
        'No Salesforce opportunity was found for that ID.',
      );
    }

    const resolvedId = this.readString(record.Id) || id;
    const reportingSmu = this.readString(record.Reporting_SMU__c);

    return {
      id: resolvedId,
      name: this.readString(record.Name) || '',
      description: this.readString(record.Description),
      customer: this.readString(record.Subcontracting_End_Customer__r?.Name),
      ...this.mapSmu(reportingSmu),
      reportingSmu,
      closeDate: this.readString(record.CloseDate),
      stageName: this.readString(record.StageName),
      url: `${this.client.instanceOrigin()}/${resolvedId}`,
    };
  }
}
