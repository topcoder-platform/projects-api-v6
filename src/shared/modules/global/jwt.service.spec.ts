import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
const sharedRequire = createRequire(require.resolve('tc-core-library-js'));
const { JwksClient } = sharedRequire('jwks-rsa') as {
  JwksClient: {
    prototype: {
      getSigningKey(kid: string): Promise<{ getPublicKey(): string }>;
    };
  };
};
import * as jwt from 'jsonwebtoken';
import { Scope } from 'src/shared/enums/scopes.enum';
import { JwtService } from './jwt.service';

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, 'test-secret-with-at-least-32-bytes-long', {
    issuer: 'https://issuer.test/',
    audience: 'api',
    expiresIn: 300,
  });
}

describe('JwtService', () => {
  let service: JwtService;

  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-with-at-least-32-bytes-long';
    process.env.VALID_ISSUERS = JSON.stringify(['https://issuer.test/']);
    process.env.AUTH0_AUDIENCE = 'api';
    service = new JwtService();
    service.onModuleInit();
  });

  it('prefers numeric userId claim over non-numeric sub', async () => {
    const token = signToken({
      userId: 12345,
      sub: 'auth0|abcd',
    });

    const user = await service.validateToken(token);

    expect(user.userId).toBe('12345');
  });

  it('uses namespaced userId claim when sub is non-numeric', async () => {
    const token = signToken({
      sub: 'auth0|abcd',
      'https://topcoder.com/userId': 67890,
    });

    const user = await service.validateToken(token);

    expect(user.userId).toBe('67890');
  });

  it('falls back to sub when user id claim is unavailable', async () => {
    const token = signToken({
      sub: 'auth0|abcd',
    });

    const user = await service.validateToken(token);

    expect(user.userId).toBe('auth0|abcd');
  });

  it('extracts Auth0 client-credentials scopes for machine subjects', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const keySpy = jest
      .spyOn(JwksClient.prototype, 'getSigningKey')
      .mockResolvedValue({
        getPublicKey: () =>
          publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      });
    service.onModuleInit();
    const token = jwt.sign(
      {
        sub: 'VYWpLOVcDTMvUUlZmNaqhwxjqXWn0qu8@clients',
        azp: 'VYWpLOVcDTMvUUlZmNaqhwxjqXWn0qu8',
        gty: 'client-credentials',
        scope: `${Scope.PROJECTS_READ} ${Scope.PROJECT_MEMBERS_WRITE}`,
      },
      privateKey,
      {
        algorithm: 'RS256',
        keyid: 'test-key',
        issuer: 'https://issuer.test/',
        audience: 'api',
        expiresIn: 300,
      },
    );

    const user = await service.validateToken(token);
    keySpy.mockRestore();

    expect(user).toEqual(
      expect.objectContaining({
        userId: 'VYWpLOVcDTMvUUlZmNaqhwxjqXWn0qu8@clients',
        isMachine: true,
        scopes: expect.arrayContaining([
          Scope.PROJECTS_READ,
          Scope.PROJECT_MEMBERS_WRITE,
        ]),
        tokenPayload: expect.objectContaining({
          sub: 'VYWpLOVcDTMvUUlZmNaqhwxjqXWn0qu8@clients',
          azp: 'VYWpLOVcDTMvUUlZmNaqhwxjqXWn0qu8',
          gty: 'client-credentials',
        }),
      }),
    );
  });

  it('extracts lower-cased email from namespaced email claim', async () => {
    const token = signToken({
      sub: 'auth0|abcd',
      'https://topcoder-dev.com/email': 'User+Alias@Example.com',
    });

    const user = await service.validateToken(token);

    expect(user.email).toBe('user+alias@example.com');
  });
});
