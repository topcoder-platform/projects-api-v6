import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';

/** Signs synthetic member claims for the adapter boundary; returns a short-lived JWT or throws for malformed test data. */
function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(
    { iss: 'https://members.example.test', sub: 'auth0|abcd', ...payload },
    'test-secret',
    { expiresIn: 120 },
  );
}

describe('JwtService', () => {
  let service: JwtService;
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH_SECRET: 'test-secret',
      VALID_ISSUERS: '["https://members.example.test"]',
    };
    service = new JwtService();
    service.onModuleInit();
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('preserves numeric member IDs as strings', async () => {
    await expect(
      service.validateToken(signToken({ userId: 12345 })),
    ).resolves.toMatchObject({
      userId: '12345',
      kind: 'user',
      isMachine: false,
    });
  });
  it('accepts configured exact namespaced member claims', async () => {
    await expect(
      service.validateToken(
        signToken({ 'https://topcoder.com/userId': 67890 }),
      ),
    ).resolves.toMatchObject({ userId: '67890' });
  });
  it('rejects a nonnumeric subject without a member ID', async () => {
    await expect(service.validateToken(signToken({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
  it('discards member scopes and rejects machine-like member tokens', async () => {
    await expect(
      service.validateToken(
        signToken({ userId: 12345, scope: 'read:projects' }),
      ),
    ).resolves.toMatchObject({ kind: 'user', scopes: [] });
    await expect(
      service.validateToken(
        signToken({
          gty: 'client-credentials',
          azp: 'm2m-test',
          scope: 'read:projects',
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('adapts only verified normalized email', async () => {
    await expect(
      service.validateToken(
        signToken({
          userId: 42,
          'https://topcoder-dev.com/email': 'User+Alias@Example.com',
        }),
      ),
    ).resolves.toMatchObject({ email: 'user+alias@example.com' });
  });
});
