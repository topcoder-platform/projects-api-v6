import { BadRequestException } from '@nestjs/common';
import {
  normalizeShowcaseProjectMetadata,
  normalizeSmuValue,
} from './showcase-metadata.utils';

describe('shared showcase project metadata', () => {
  const metadata = {
    customer: ' Customer ',
    smu: 'Others',
    smuOther: ' Custom ',
    dealCloseDate: '2024-02-29',
  };

  it('normalizes shared fields without treating other project details as metadata', () => {
    expect(
      normalizeShowcaseProjectMetadata({ ...metadata, unrelated: true }, true),
    ).toEqual({
      customer: 'Customer',
      smu: 'Others',
      smuOther: 'Custom',
      dealCloseDate: '2024-02-29',
    });
  });

  it('allows legacy projects without metadata until a showcase requires it', () => {
    expect(normalizeShowcaseProjectMetadata({ unrelated: true })).toEqual({});
    expect(() => normalizeShowcaseProjectMetadata({}, true)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    { customer: null },
    { customer: ' ' },
    { smu: 'Invalid' },
    { smuOther: ' ' },
    { dealCloseDate: '2026-02-29' },
    { dealCloseDate: '2026-04-31' },
    { dealCloseDate: '2026-01-01T00:00:00Z' },
    { dealCloseDate: 'garbage' },
  ])('rejects invalid shared metadata: %j', (patch) => {
    expect(() =>
      normalizeShowcaseProjectMetadata({ ...metadata, ...patch }, true),
    ).toThrow(BadRequestException);
  });

  it('clears a stale custom SMU when a standard SMU is selected', () => {
    expect(
      normalizeShowcaseProjectMetadata({ ...metadata, smu: 'EURP' }, true)
        .smuOther,
    ).toBe('');
  });

  it.each([
    ['APMEA', 'APME'],
    ['Europe', 'EURP'],
    ['Americas1', 'AMR1'],
    ['Americas2', 'AMR2'],
    ['AMR1', 'AMR1'],
    ['Others', 'Others'],
  ])('upgrades the legacy SMU label %s to %s', (stored, expected) => {
    expect(normalizeSmuValue(stored)).toBe(expected);
    expect(
      normalizeShowcaseProjectMetadata({ ...metadata, smu: stored }).smu,
    ).toBe(expected);
  });

  it('keeps a Salesforce opportunity id and trims it', () => {
    expect(
      normalizeShowcaseProjectMetadata({
        ...metadata,
        salesforceOpportunityId: ' 006UN00000XamntYAB ',
      }).salesforceOpportunityId,
    ).toBe('006UN00000XamntYAB');
  });

  it('accepts a cleared Salesforce opportunity id', () => {
    expect(
      normalizeShowcaseProjectMetadata({
        ...metadata,
        salesforceOpportunityId: '',
      }).salesforceOpportunityId,
    ).toBe('');
  });

  it.each([
    '006UN00000Xamn',
    '001UN00000XamntYAB',
    '006UN00000XamntYA',
    "006UN00000Xamnt' OR Id != '",
    42,
  ])(
    'rejects an invalid Salesforce opportunity id: %j',
    (salesforceOpportunityId) => {
      expect(() =>
        normalizeShowcaseProjectMetadata({
          ...metadata,
          salesforceOpportunityId,
        }),
      ).toThrow(BadRequestException);
    },
  );
});
