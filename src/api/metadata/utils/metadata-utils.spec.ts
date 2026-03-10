import { ForbiddenException } from '@nestjs/common';
import { getAuditUserIdBigInt, getAuditUserIdNumber } from './metadata-utils';

describe('metadata utils', () => {
  it('returns -1 for machine principals inferred from token claims in number audit fields', () => {
    expect(
      getAuditUserIdNumber({
        isMachine: false,
        scopes: ['write:projects'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:projects',
          sub: 'svc-projects',
        },
      }),
    ).toBe(-1);
  });

  it('returns -1n for machine principals inferred from token claims in bigint audit fields', () => {
    expect(
      getAuditUserIdBigInt({
        isMachine: false,
        scopes: ['write:projects'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:projects',
          sub: 'svc-projects',
        },
      }),
    ).toBe(BigInt(-1));
  });

  it('throws for human tokens with non-numeric user ids', () => {
    expect(() =>
      getAuditUserIdNumber({
        userId: 'not-a-number',
        isMachine: false,
      }),
    ).toThrow(ForbiddenException);
  });
});
