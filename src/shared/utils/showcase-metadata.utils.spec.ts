import { BadRequestException } from '@nestjs/common';
import { normalizeShowcaseProjectMetadata } from './showcase-metadata.utils';

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
      normalizeShowcaseProjectMetadata({ ...metadata, smu: 'Europe' }, true)
        .smuOther,
    ).toBe('');
  });
});
