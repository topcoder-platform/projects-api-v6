import { Scope } from 'src/shared/enums/scopes.enum';
import { M2MService } from './m2m.service';

describe('M2MService', () => {
  let service: M2MService;

  beforeEach(() => {
    service = new M2MService();
  });

  describe('expandScopes', () => {
    it('expands hierarchy for all:projects', () => {
      const expandedScopes = service.expandScopes([Scope.PROJECTS_ALL]);

      expect(expandedScopes).toEqual(
        expect.arrayContaining([
          Scope.PROJECTS_ALL,
          Scope.PROJECTS_READ,
          Scope.PROJECTS_WRITE,
        ]),
      );
    });

    it('normalizes all:project alias and expands connect project scopes', () => {
      const expandedScopes = service.expandScopes([
        Scope.CONNECT_PROJECT_ADMIN_ALIAS,
      ]);

      expect(expandedScopes).toEqual(
        expect.arrayContaining([
          Scope.CONNECT_PROJECT_ADMIN,
          Scope.PROJECTS_READ,
          Scope.PROJECT_MEMBERS_READ,
        ]),
      );
    });
  });

  describe('hasRequiredScopes', () => {
    it('returns true when token has hierarchical parent scope', () => {
      expect(
        service.hasRequiredScopes([Scope.PROJECTS_ALL], [Scope.PROJECTS_WRITE]),
      ).toBe(true);
    });

    it('returns true when token has synonym alias scope', () => {
      expect(
        service.hasRequiredScopes(
          [Scope.CONNECT_PROJECT_ADMIN_ALIAS],
          [Scope.PROJECT_INVITES_WRITE],
        ),
      ).toBe(true);
    });

    it('returns false when required scopes are not present', () => {
      expect(
        service.hasRequiredScopes(
          [Scope.PROJECT_MEMBERS_READ],
          [Scope.PROJECTS_WRITE],
        ),
      ).toBe(false);
    });

    it('returns true when requiredScopes is empty', () => {
      expect(service.hasRequiredScopes([Scope.PROJECTS_READ], [])).toBe(true);
    });
  });
});
