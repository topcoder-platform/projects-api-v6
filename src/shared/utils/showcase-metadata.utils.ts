import { BadRequestException } from '@nestjs/common';

/**
 * Supported SMU options.
 *
 * These match the Salesforce `Opportunity.Reporting_SMU__c` codes so an
 * imported opportunity maps onto a project without translation.
 */
export const SMU_VALUES = ['APME', 'EURP', 'AMR1', 'AMR2', 'Others'];

/**
 * SMU labels used before the Salesforce naming alignment.
 *
 * Projects saved with the old labels are upgraded in place the next time their
 * details are written, so historical records stay valid.
 */
export const LEGACY_SMU_VALUES: Readonly<Record<string, string>> = {
  APMEA: 'APME',
  Europe: 'EURP',
  Americas1: 'AMR1',
  Americas2: 'AMR2',
};

export const SHOWCASE_TYPES = [
  'Open Innovation',
  'Private POD Delivery',
  'Flexi-Talent Supply',
  'AI Data Licensing',
];
export const SHOWCASE_CURRENT_STATUSES = [
  'Delivered',
  'In Delivery',
  'On-Hold',
  'Planned',
];
export const PROJECT_SHOWCASE_METADATA_KEYS = [
  'customer',
  'smu',
  'smuOther',
  'dealCloseDate',
] as const;

/**
 * `Project.details` key holding the linked Salesforce opportunity.
 */
export const PROJECT_SALESFORCE_OPPORTUNITY_ID_KEY =
  'salesforceOpportunityId' as const;

/**
 * Salesforce opportunity record ids: the `006` key prefix plus 12 or 15
 * case-sensitive alphanumeric characters.
 */
export const SALESFORCE_OPPORTUNITY_ID_PATTERN =
  /^006[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/;

export type ProjectShowcaseMetadata = Partial<
  Record<
    | (typeof PROJECT_SHOWCASE_METADATA_KEYS)[number]
    | typeof PROJECT_SALESFORCE_OPPORTUNITY_ID_KEY,
    string
  >
>;

/**
 * Maps a stored or supplied SMU label onto a currently supported option.
 * @param value Raw SMU string from a request or from existing project details.
 * @returns The supported option, or the original value when it is unknown.
 * @throws Does not throw.
 */
export function normalizeSmuValue(value: string): string {
  return LEGACY_SMU_VALUES[value] ?? value;
}

/**
 * Validates and normalizes the shared project fields stored in Project.details.
 * Used by project writes and atomic showcase saves without removing other details.
 * @param details Project details or the merged showcase metadata candidate.
 * @param required Whether Customer, SMU and Deal Close Date must be nonempty.
 * @returns Only supplied showcase metadata fields, with unused custom SMU cleared.
 * @throws BadRequestException for invalid strings, SMU, calendar dates, Salesforce opportunity ids or required fields.
 */
export function normalizeShowcaseProjectMetadata(
  details: Record<string, unknown> | null | undefined,
  required = false,
): ProjectShowcaseMetadata {
  const result: ProjectShowcaseMetadata = {};
  for (const key of PROJECT_SHOWCASE_METADATA_KEYS) {
    const value = details?.[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim().length > 255) {
      throw new BadRequestException(
        `${key} must be a string of at most 255 characters.`,
      );
    }
    result[key] = value.trim();
  }
  if (result.smu) result.smu = normalizeSmuValue(result.smu);
  if (required) {
    for (const key of ['customer', 'smu', 'dealCloseDate'] as const) {
      if (!result[key]) throw new BadRequestException(`${key} is required.`);
    }
  }
  if (result.smu && !SMU_VALUES.includes(result.smu)) {
    throw new BadRequestException('Invalid SMU.');
  }
  if (result.smu === 'Others' && !result.smuOther) {
    throw new BadRequestException('smuOther is required when SMU is Others.');
  }
  if (result.smu !== undefined && result.smu !== 'Others') result.smuOther = '';
  if (result.dealCloseDate) {
    const date = new Date(`${result.dealCloseDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(result.dealCloseDate) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== result.dealCloseDate
    ) {
      throw new BadRequestException(
        'dealCloseDate must be a valid YYYY-MM-DD calendar date.',
      );
    }
  }
  const opportunityId = details?.[PROJECT_SALESFORCE_OPPORTUNITY_ID_KEY];
  if (opportunityId !== undefined) {
    if (typeof opportunityId !== 'string') {
      throw new BadRequestException(
        `${PROJECT_SALESFORCE_OPPORTUNITY_ID_KEY} must be a string.`,
      );
    }
    const trimmed = opportunityId.trim();
    if (trimmed && !SALESFORCE_OPPORTUNITY_ID_PATTERN.test(trimmed)) {
      throw new BadRequestException(
        `${PROJECT_SALESFORCE_OPPORTUNITY_ID_KEY} must be a 15 or 18 character Salesforce opportunity id.`,
      );
    }
    result[PROJECT_SALESFORCE_OPPORTUNITY_ID_KEY] = trimmed;
  }
  return result;
}
