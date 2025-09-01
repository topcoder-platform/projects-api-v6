

export const AppConfig = {
  port: Number(process.env.PORT) || 3000,
  prefix: process.env.API_PREFIX || '/v5',
  maxPhaseProductCount: process.env.MAX_PHASE_PRODUCT_COUNT || 100,

  authSecret: process.env.AUTH_SECRET || 'secret',
  validIssuers: process.env.VALID_ISSUERS
    ? process.env.VALID_ISSUERS.replace(/\\"/g, '')
    : '["https://api.topcoder-dev.com", "https://api.topcoder.com","https://topcoder-dev.auth0.com/"]'
}

export const Auth0Config = {
  url: process.env.AUTH0_URL || 'http://localhost:4000/oauth/token',
  proxyServerUrl: process.env.AUTH0_PROXY_SERVER_URL || 'http://localhost:4000/oauth/token',
  audience: process.env.AUTH0_AUDIENCE || 'http://localhost:4000',
  clientId: process.env.AUTH0_CLIENT_ID || 'abc123',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || 'secret',
  tokenCacheTime: process.env.TOKEN_CACHE_TIME ?? 86400000,
}

export const EventBusConfig = {
  url: process.env.BUSAPI_URL || 'http://localhost:4000/eventBus',
  kafkaErrorTopic: process.env.KAFKA_ERROR_TOPIC ?? 'common.error.reporting',
}

