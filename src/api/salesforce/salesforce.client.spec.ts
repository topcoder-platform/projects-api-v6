import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SalesforceClient } from './salesforce.client';

/**
 * Builds a fetch Response stub whose body can be cancelled by the client.
 */
function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    body: { cancel: jest.fn().mockResolvedValue(undefined) },
    json: () =>
      body === undefined
        ? Promise.reject(new Error('invalid json'))
        : Promise.resolve(body),
  } as unknown as Response;
}

const token = {
  access_token: 'token',
  instance_url: 'https://topcoder.my.salesforce.com',
};

describe('SalesforceClient', () => {
  const originalEnv = process.env;
  let fetchMock: jest.Mock;

  /**
   * Creates a client that reads the environment set by the current test.
   */
  function loadClient(): { client: SalesforceClient } {
    return { client: new SalesforceClient() };
  }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SALESFORCE_API_CONSUMER_KEY: 'key',
      SALESFORCE_API_CONSUMER_SECRET: 'secret',
      SALESFORCE_LOGIN_URL: 'https://topcoder.my.salesforce.com',
      SALESFORCE_REST_API_VERSION: '65.0',
    };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('authenticates once and reuses the session for later queries', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, token))
      .mockResolvedValue(response(200, { records: [{ Id: '1' }] }));
    const { client } = loadClient();

    await expect(client.query('SELECT Id FROM Opportunity')).resolves.toEqual([
      { Id: '1' },
    ]);
    await expect(client.query('SELECT Id FROM Opportunity')).resolves.toEqual([
      { Id: '1' },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://topcoder.my.salesforce.com/services/oauth2/token',
    );
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/services/data/v65.0/query?q=',
    );
  });

  it('renews the session once when Salesforce rejects the token', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, token))
      .mockResolvedValueOnce(response(401, {}))
      .mockResolvedValueOnce(response(200, token))
      .mockResolvedValueOnce(response(200, { records: [] }));
    const { client } = loadClient();

    await expect(client.query('SELECT Id FROM Opportunity')).resolves.toEqual(
      [],
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('does not send credentials to an untrusted origin', async () => {
    process.env.SALESFORCE_LOGIN_URL = 'https://attacker.example.com';
    const { client } = loadClient();

    await expect(
      client.query('SELECT Id FROM Opportunity'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports missing credentials as unconfigured', async () => {
    delete process.env.SALESFORCE_API_CONSUMER_SECRET;
    const { client } = loadClient();

    expect(client.isConfigured()).toBe(false);
    await expect(
      client.query('SELECT Id FROM Opportunity'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed API version before calling Salesforce', async () => {
    process.env.SALESFORCE_REST_API_VERSION = 'v65';
    const { client } = loadClient();

    await expect(
      client.query('SELECT Id FROM Opportunity'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces a sanitized error when the query is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(response(200, token))
      .mockResolvedValue(response(400, { message: 'MALFORMED_QUERY' }));
    const { client } = loadClient();

    await expect(
      client.query('SELECT Id FROM Opportunity'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('gives up after three transient failures', async () => {
    fetchMock.mockResolvedValue(response(503, {}));
    const { client } = loadClient();

    await expect(
      client.query('SELECT Id FROM Opportunity'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
