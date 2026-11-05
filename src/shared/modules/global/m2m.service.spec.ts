import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { LoggerService } from './logger.service';
import { Scope } from 'src/shared/enums/scopes.enum';
import { M2MService } from './m2m.service';

describe('M2MService', () => {
  let service: M2MService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AUTH0_URL: 'https://auth.example.test/oauth/token',
      AUTH0_AUDIENCE: 'https://api.example.test/',
      AUTH0_PROXY_SERVER_URL: 'https://proxy.example.test/token',
      AUTH0_CLIENT_ID: 'test-client',
      AUTH0_CLIENT_SECRET: 'test-secret',
    };
    service = new M2MService();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('getM2MToken with the installed tc-core library', () => {
    let server: Server;
    let requests: { url?: string; body: Record<string, unknown> }[];
    let responseStatus: number;

    beforeEach(async () => {
      requests = [];
      responseStatus = 200;
      server = createServer((request, response) => {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk: string) => {
          body += chunk;
        });
        request.on('end', () => {
          requests.push({
            url: request.url,
            body: JSON.parse(body) as Record<string, unknown>,
          });
          response.writeHead(responseStatus, {
            'Content-Type': 'application/json',
          });
          response.end(
            JSON.stringify(
              responseStatus === 200
                ? { access_token: 'test-machine-token', expires_in: 3600 }
                : { error: 'invalid_client' },
            ),
          );
        });
      });
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as AddressInfo;
      process.env.AUTH0_PROXY_SERVER_URL = `http://127.0.0.1:${port}/token`;
      service = new M2MService();
    });

    afterEach(async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    });

    it('acquires and caches a token through the configured Auth0 proxy', async () => {
      await expect(service.getM2MToken()).resolves.toBe('test-machine-token');
      await expect(service.getM2MToken()).resolves.toBe('test-machine-token');
      expect(requests).toEqual([
        {
          url: '/token',
          body: {
            grant_type: 'client_credentials',
            client_id: 'test-client',
            client_secret: 'test-secret',
            audience: 'https://api.example.test/',
            auth0_url: 'https://auth.example.test/oauth/token',
          },
        },
      ]);
    });

    it('rejects missing credentials before making a token request', async () => {
      delete process.env.AUTH0_CLIENT_SECRET;
      await expect(service.getM2MToken()).rejects.toThrow(
        'M2M credentials are not configured.',
      );
      expect(requests).toHaveLength(0);
    });

    it('preserves the service error when the token endpoint rejects credentials', async () => {
      responseStatus = 401;
      jest.spyOn(LoggerService.prototype, 'error').mockImplementation(() => {});
      await expect(service.getM2MToken()).rejects.toThrow(
        'Failed to retrieve M2M token.',
      );
      expect(requests).toHaveLength(1);
    });
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
