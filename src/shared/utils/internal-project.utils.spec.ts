import {
  activeProjectMembershipWhere,
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

  it.each([undefined, '', 'handle', '42broken'])(
    'does not grant membership for an unresolved identity %s',
    (userId) => {
      expect(
        activeProjectMembershipWhere({ userId, isMachine: false }),
      ).toEqual({
        userId: -1n,
        deletedAt: null,
      });
    },
  );

  it('normalizes numeric membership identities without precision loss', () => {
    expect(
      activeProjectMembershipWhere({
        userId: ' 9007199254740993 ',
        isMachine: false,
      }),
    ).toEqual({
      userId: 9007199254740993n,
      deletedAt: null,
    });
  });

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
    'allows active membership to override internal exclusions with memberOnly=%s',
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
              { members: { some: { userId: 42n, deletedAt: null } } },
            ],
          },
        ]),
      );
      expect((where.AND as unknown[]).length).toBe(memberOnly ? 2 : 1);
    },
  );
});
