

export const AppConfig = {
  port: Number(process.env.PORT) || 3000,
  prefix: process.env.API_PREFIX || '/v6',

  authSecret: process.env.AUTH_SECRET || 'secret',
  validIssuers: process.env.VALID_ISSUERS
    ? process.env.VALID_ISSUERS.replace(/\\"/g, '')
    : '["https://api.topcoder-dev.com", "https://api.topcoder.com","https://topcoder-dev.auth0.com/"]'
}

export const Auth0Config = {
  url: process.env.AUTH0_URL || 'https://topcoder-dev.auth0.com/oauth/token',
  proxyServerUrl: process.env.AUTH0_PROXY_SERVER_URL || 'https://auth0proxy.topcoder-dev.com/token',
  audience: process.env.AUTH0_AUDIENCE || 'https://m2m.topcoder-dev.com/',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET
}

export const EventBusConfig = {
  url: process.env.BUSAPI_URL || 'https://api.topcoder-dev.com/v5'
}

