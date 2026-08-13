import { parseOptionalStringArray } from './dto-transform.utils';

describe('parseOptionalStringArray', () => {
  it('normalizes comma-separated, repeated, and bracket-notation values', () => {
    expect(
      parseOptionalStringArray({
        $in: ['active,completed', 'active'],
      }),
    ).toEqual(['active', 'completed']);
  });

  it('drops empty and unsupported values', () => {
    expect(parseOptionalStringArray([' ', null, undefined])).toBeUndefined();
  });
});
