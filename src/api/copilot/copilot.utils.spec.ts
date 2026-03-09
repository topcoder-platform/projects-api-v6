import { BadRequestException } from '@nestjs/common';
import { getAuditUserId } from './copilot.utils';

describe('copilot utils', () => {
  it('returns -1 for machine tokens without numeric user ids', () => {
    expect(
      getAuditUserId({
        isMachine: true,
        tokenPayload: {
          gty: 'client-credentials',
        },
      }),
    ).toBe(-1);
  });

  it('throws for human tokens without numeric user ids', () => {
    expect(() =>
      getAuditUserId({
        userId: 'not-a-number',
        isMachine: false,
      }),
    ).toThrow(BadRequestException);
  });
});
