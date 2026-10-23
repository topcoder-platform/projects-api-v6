/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-return */
// Proves that every outbound M2M path (M2MService, EventBusService and the
// event.utils Bus client) follows USE_KEYCLOAK. Synthetic values only.
const saved = { ...process.env };

const auth0Env = {
  AUTH0_URL: 'https://tenant.example/oauth/token',
  AUTH0_AUDIENCE: 'https://m2m.example/',
  AUTH0_PROXY_SERVER_URL: 'https://proxy.example/token',
  AUTH0_CLIENT_ID: 'auth0-projects',
  AUTH0_CLIENT_SECRET: 'auth0-secret',
  BUSAPI_URL: 'https://bus.example/v5',
  KAFKA_ERROR_TOPIC: 'common.error.reporting',
};
// The Keycloak values come from src/test-keycloak.setup.ts.
const keycloakBus = {
  AUTH0_URL: 'https://keycloak.example.test/m2m/token',
  AUTH0_AUDIENCE: 'https://api.example.test',
  AUTH0_PROXY_SERVER_URL: 'https://keycloak.example.test/m2m/token',
  AUTH0_CLIENT_ID: 'm2m-test',
  AUTH0_CLIENT_SECRET: 'synthetic-test-secret',
};
const auth0Bus = {
  AUTH0_URL: auth0Env.AUTH0_URL,
  AUTH0_AUDIENCE: auth0Env.AUTH0_AUDIENCE,
  AUTH0_PROXY_SERVER_URL: auth0Env.AUTH0_PROXY_SERVER_URL,
  AUTH0_CLIENT_ID: 'auth0-projects',
  AUTH0_CLIENT_SECRET: 'auth0-secret',
};

/**
 * Loads the outbound modules fresh with the given environment overrides.
 * @param env Values merged over the saved environment and the Auth0 fixture; `undefined` deletes a key.
 * @param spyM2m When true, `auth.m2m` returns a stub provider instead of the real core provider.
 * @returns The loaded modules, the Bus wrapper factory mock and the `auth.m2m` spy/stub.
 */
function load(env: Record<string, string | undefined>, spyM2m = true) {
  process.env = { ...saved, ...auth0Env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  let loaded: any;
  jest.isolateModules(() => {
    const factory = jest.fn(() => ({ postEvent: jest.fn() }));
    jest.doMock('tc-bus-api-wrapper', () => factory);
    const core = require('tc-core-library-js');
    const provider = { getMachineToken: jest.fn().mockResolvedValue('token') };
    const m2m = spyM2m
      ? jest.spyOn(core.auth, 'm2m').mockReturnValue(provider)
      : undefined;
    loaded = {
      factory,
      m2m,
      provider,
      M2MService: require('./m2m.service').M2MService,
      EventBusService: require('./eventBus.service').EventBusService,
      eventUtils: require('../../utils/event.utils'),
    };
  });
  return loaded;
}

describe('USE_KEYCLOAK provider selection', () => {
  afterEach(() => {
    process.env = { ...saved };
    jest.restoreAllMocks();
  });

  it('uses the Auth0 settings everywhere when USE_KEYCLOAK=false', async () => {
    const { M2MService, EventBusService, eventUtils, factory, m2m, provider } =
      load({ USE_KEYCLOAK: 'false' });
    const service = new M2MService();
    expect(m2m).toHaveBeenCalledWith({
      AUTH0_URL: auth0Env.AUTH0_URL,
      AUTH0_AUDIENCE: auth0Env.AUTH0_AUDIENCE,
      AUTH0_PROXY_SERVER_URL: auth0Env.AUTH0_PROXY_SERVER_URL,
    });
    await expect(service.getM2MToken()).resolves.toBe('token');
    expect(provider.getMachineToken).toHaveBeenCalledWith();

    new EventBusService();
    await eventUtils.getBusApiClient();
    expect(factory).toHaveBeenCalledTimes(2);
    for (const [config] of factory.mock.calls as unknown as [
      Record<string, unknown>,
    ][]) {
      expect(config).toEqual({
        BUSAPI_URL: auth0Env.BUSAPI_URL,
        KAFKA_ERROR_TOPIC: auth0Env.KAFKA_ERROR_TOPIC,
        ...auth0Bus,
        TOKEN_CACHE_TIME: 900,
      });
    }
  });

  it('uses the Keycloak settings everywhere when USE_KEYCLOAK=true', async () => {
    const { EventBusService, eventUtils, factory } = load({
      USE_KEYCLOAK: 'true',
    });
    new EventBusService();
    await eventUtils.getBusApiClient();
    expect(factory).toHaveBeenCalledTimes(2);
    for (const [config] of factory.mock.calls as unknown as [
      Record<string, unknown>,
    ][]) {
      expect(config).toEqual({
        BUSAPI_URL: auth0Env.BUSAPI_URL,
        KAFKA_ERROR_TOPIC: auth0Env.KAFKA_ERROR_TOPIC,
        ...keycloakBus,
        TOKEN_CACHE_TIME: 900,
      });
    }
  });

  it('defaults to Auth0 when USE_KEYCLOAK is unset', async () => {
    const { eventUtils, factory } = load({ USE_KEYCLOAK: undefined });
    await eventUtils.getBusApiClient();
    expect(factory.mock.calls[0]).toEqual([expect.objectContaining(auth0Bus)]);
  });

  it('never sends the other provider credentials from M2MService', async () => {
    // Real core providers; missing credentials reject before any request is made.
    let { M2MService } = load(
      { USE_KEYCLOAK: 'false', AUTH0_CLIENT_ID: undefined },
      false,
    );
    await expect(new M2MService().getM2MToken()).rejects.toThrow(
      'AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are required',
    );
    ({ M2MService } = load(
      { USE_KEYCLOAK: 'true', KEYCLOAK_CLIENT_ID: undefined },
      false,
    ));
    await expect(new M2MService().getM2MToken()).rejects.toThrow(
      'KEYCLOAK_CLIENT_ID and KEYCLOAK_CLIENT_SECRET are required',
    );
  });

  it('checks only the active provider settings before creating the Bus client', () => {
    let { EventBusService, factory } = load({
      USE_KEYCLOAK: 'false',
      KEYCLOAK_TOKEN_URL: undefined,
    });
    new EventBusService();
    expect(factory).toHaveBeenCalledTimes(1);

    ({ EventBusService, factory } = load({
      USE_KEYCLOAK: 'false',
      AUTH0_URL: undefined,
    }));
    new EventBusService();
    expect(factory).not.toHaveBeenCalled();

    ({ EventBusService, factory } = load({
      USE_KEYCLOAK: 'true',
      AUTH0_URL: undefined,
    }));
    new EventBusService();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('fails fast for a USE_KEYCLOAK value other than true or false', () => {
    const { M2MService, EventBusService } = load(
      { USE_KEYCLOAK: 'yes' },
      false,
    );
    expect(() => new M2MService()).toThrow(TypeError);
    expect(() => new EventBusService()).toThrow(TypeError);
  });
});
