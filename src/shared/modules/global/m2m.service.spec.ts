import { Scope } from 'src/shared/enums/scopes.enum';
import { M2MService } from './m2m.service';
import { JwtUser } from './jwt.service';

/** Creates a normalized service fixture with supplied scopes; returns a principal without I/O or exceptions. */
function machine(scopes: string[]): JwtUser {
  return { kind: 'service', isMachine: true, roles: [], scopes };
}

describe('M2MService route policy', () => {
  const service = new M2MService();
  it('expands granted all scopes and explicit legacy aliases', () => {
    expect(service.expandScopes([Scope.PROJECTS_ALL])).toEqual(
      expect.arrayContaining([Scope.PROJECTS_READ, Scope.PROJECTS_WRITE]),
    );
    expect(service.expandScopes([Scope.CONNECT_PROJECT_ADMIN_ALIAS])).toEqual(
      expect.arrayContaining([
        Scope.CONNECT_PROJECT_ADMIN,
        Scope.PROJECT_MEMBERS_READ,
      ]),
    );
  });
  it('accepts a granted parent or configured alias', () => {
    expect(
      service.hasRequiredScopes(machine([Scope.PROJECTS_ALL]), [
        Scope.PROJECTS_WRITE,
      ]),
    ).toBe(true);
    expect(
      service.hasRequiredScopes(machine([Scope.CONNECT_PROJECT_ADMIN_ALIAS]), [
        Scope.PROJECT_INVITES_WRITE,
      ]),
    ).toBe(true);
  });
  it('never promotes read or write to all/admin', () => {
    expect(
      service.hasRequiredScopes(machine([Scope.PROJECTS_READ]), [
        Scope.PROJECTS_ALL,
      ]),
    ).toBe(false);
    expect(
      service.hasRequiredScopes(machine([Scope.PROJECTS_WRITE]), [
        Scope.CONNECT_PROJECT_ADMIN,
      ]),
    ).toBe(false);
    expect(
      service.hasRequiredScopes(machine([Scope.PROJECTS_READ]), [
        Scope.PROJECTS_WRITE,
      ]),
    ).toBe(false);
  });
  it('denies members, wrong case and an empty policy', () => {
    expect(
      service.hasRequiredScopes(
        { kind: 'user', isMachine: false, scopes: [Scope.PROJECTS_ALL] },
        [Scope.PROJECTS_READ],
      ),
    ).toBe(false);
    expect(
      service.hasRequiredScopes(machine(['ALL:PROJECTS']), [
        Scope.PROJECTS_READ,
      ]),
    ).toBe(false);
    expect(service.hasRequiredScopes(machine([Scope.PROJECTS_READ]), [])).toBe(
      false,
    );
  });
  it('ignores raw machine markers and broader raw scope claims', () => {
    expect(
      service.validateMachineToken({
        kind: 'user',
        isMachine: false,
        scopes: [],
        tokenPayload: {
          gty: 'client-credentials',
          scope: Scope.CONNECT_PROJECT_ADMIN,
        },
      }),
    ).toEqual({ isMachine: false, scopes: [] });
  });
});
