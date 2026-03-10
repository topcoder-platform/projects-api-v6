import { extractScopesFromPayload } from './scope.utils';

describe('extractScopesFromPayload', () => {
  it('splits string claims on arbitrary whitespace', () => {
    expect(
      extractScopesFromPayload({
        scope: 'all:projects\twrite:projects\nread:projects',
      }),
    ).toEqual(['all:projects', 'write:projects', 'read:projects']);
  });

  it('merges supported scope claims and deduplicates values', () => {
    expect(
      extractScopesFromPayload({
        scope: 'all:projects',
        scp: 'write:projects',
        scopes: ['all:projects', 'read:projects'],
        permissions: ['write:projects', 'all:connect_project'],
      }),
    ).toEqual([
      'all:projects',
      'read:projects',
      'write:projects',
      'all:connect_project',
    ]);
  });
});
