import {
  internalBillingAccountIds,
  isRestrictedTalentManager,
} from './internal-project.utils';
import { buildProjectWhereClause } from './project.utils';

describe('Talent Manager internal project visibility', () => {
  const originalIds = process.env.INTERNAL_BILLING_ACCOUNT_IDS;
  afterEach(() => {
    if (originalIds === undefined)
      delete process.env.INTERNAL_BILLING_ACCOUNT_IDS;
    else process.env.INTERNAL_BILLING_ACCOUNT_IDS = originalIds;
  });

  it.each(['Talent Manager', ' Topcoder Talent Manager '])(
    'restricts %s',
    (role) => {
      expect(
        isRestrictedTalentManager({
          isMachine: false,
          userId: '42',
          roles: [role],
        }),
      ).toBe(true);
    },
  );

  it('retains administrator and machine policies', () => {
    expect(
      isRestrictedTalentManager({
        isMachine: false,
        roles: ['Talent Manager', 'administrator'],
      }),
    ).toBe(false);
    expect(
      isRestrictedTalentManager({ roles: ['Talent Manager'], isMachine: true }),
    ).toBe(false);
    expect(
      isRestrictedTalentManager({
        isMachine: false,
        roles: ['Project Manager'],
      }),
    ).toBe(false);
  });

  it('parses large IDs without precision loss and rejects invalid lists', () => {
    expect(internalBillingAccountIds('123, 9007199254740993,123')).toEqual([
      123n,
      9007199254740993n,
    ]);
    expect(() => internalBillingAccountIds('123,broken')).toThrow(
      'INTERNAL_BILLING_ACCOUNT_IDS',
    );
    expect(internalBillingAccountIds('')).toEqual([]);
  });

  it.each([false, true])(
    'excludes internal projects with memberOnly=%s',
    (memberOnly) => {
      process.env.INTERNAL_BILLING_ACCOUNT_IDS = '123,456';
      const where = buildProjectWhereClause(
        { memberOnly },
        { isMachine: false, userId: '42', roles: ['Talent Manager'] },
        true,
      );
      expect(where.AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              { billingAccountId: null },
              { billingAccountId: { notIn: [123n, 456n] } },
            ],
          },
        ]),
      );
      expect((where.AND as unknown[]).length).toBe(memberOnly ? 2 : 1);
    },
  );
});
