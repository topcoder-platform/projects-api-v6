import { ForbiddenException } from '@nestjs/common';
import { getAuditUserIdBigInt, getAuditUserIdNumber } from './metadata-utils';

describe('metadata utils', () => {
  it('returns -1 for normalized service principals in number audit fields', () => {
    expect(
      getAuditUserIdNumber({
        kind: 'service' as const,
        isMachine: true,
        clientId: 'svc-projects',
        scopes: ['write:projects'],
        tokenPayload: {
          gty: 'client-credentials',
          scope: 'write:projects',
          sub: 'svc-projects',
        },
      }),
    ).toBe(-1);
  });

  it('returns -1n for normalized service principals in bigint audit fields', () => {
    expect(
      getAuditUserIdBigInt({
        kind: 'service' as const,
        isMachine: true,
        clientId: 'svc-projects',
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
