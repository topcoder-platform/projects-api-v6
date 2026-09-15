import { BadRequestException } from '@nestjs/common';

export const SMU_VALUES = [
  'APMEA',
  'Europe',
  'Americas1',
  'Americas2',
  'Others',
];
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

export type ProjectShowcaseMetadata = Partial<
  Record<(typeof PROJECT_SHOWCASE_METADATA_KEYS)[number], string>
>;

/**
 * Validates and normalizes the shared project fields stored in Project.details.
 * Used by project writes and atomic showcase saves without removing other details.
 * @param details Project details or the merged showcase metadata candidate.
 * @param required Whether Customer, SMU and Deal Close Date must be nonempty.
 * @returns Only supplied showcase metadata fields, with unused custom SMU cleared.
 * @throws BadRequestException for invalid strings, SMU, calendar dates or required fields.
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
  return result;
}
