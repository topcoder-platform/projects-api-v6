

export const AppConfig = {
  port: Number(process.env.PORT) || 3000,
  prefix: process.env.API_PREFIX || '/v6',
  maxPhaseProductCount: process.env.MAX_PHASE_PRODUCT_COUNT || 100,
  uniqueGmailValidation: process.env.UNIQUE_GMAIL_VALIDATION === 'true' || false,
  prismaTransactionTimeout: process.env.PRISMA_TRANSACTION_TIMEOUT ? parseInt(process.env.PRISMA_TRANSACTION_TIMEOUT ) : 60000, // Sets the timeout to 60 seconds
  enableFileUpload: process.env.ENABLE_FILE_UPLOAD === 'true' || false,

  authSecret: process.env.AUTH_SECRET || 'secret',
  validIssuers: process.env.VALID_ISSUERS
    ? process.env.VALID_ISSUERS.replace(/\\"/g, '')
    : '["https://api.topcoder-dev.com", "https://api.topcoder.com","https://topcoder-dev.auth0.com/"]',
  identityServiceEndpoint: process.env.IDENTITY_SERVICE_ENDPOINT || 'http://localhost:4000/identity',
  fileServiceEndpoint: process.env.FILE_SERVICE_ENDPOINT || 'http://localhost:4000/file',
  memberServiceEndpoint: process.env.MEMBER_SERVICE_ENDPOINT || 'https://api.topcoder-dev.com/v5/members',
  copilotPortalUrl: process.env.COPILOT_PORTAL_URL || 'https://copilots.topcoder-dev.com',
  workManagerUrl: process.env.WORK_MANAGER_URL || 'https://challenges.topcoder-dev.com',
  accountsAppUrl: process.env.ACCOUNTS_APP_URL || 'https://accounts.topcoder-dev.com',
  inviteEmailSubject: process.env.INVITE_EMAIL_SUBJECT || 'You are invited to Topcoder',
  inviteEmailSectionTitle: process.env.INVITE_EMAIL_SECTION_TITLE || 'Project Invitation',
  attachmentsS3Bucket: process.env.ATTACHMENTS_S3_BUCKET || 'topcoder-prod-media',
  projectAttachmentPathPrefix: process.env.PROJECT_ATTACHMENT_PATH_PREFIX || 'projects',
  projectAttachmentPathSuffix: process.env.PROJECT_ATTACHMENT_PATH_SUFFIX || 'attachments',
  SSO_REFCODES: process.env.SSO_REFCODES || '[]',
}

export const Auth0Config = {
  url: process.env.AUTH0_URL || 'http://localhost:4000/oauth/token',
  proxyServerUrl: process.env.AUTH0_PROXY_SERVER_URL || 'http://localhost:4000/oauth/token',
  audience: process.env.AUTH0_AUDIENCE || 'http://localhost:4000',
  clientId: process.env.AUTH0_CLIENT_ID || 'abc123',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || 'secret',
  tokenCacheTime: process.env.TOKEN_CACHE_TIME ?? 86400000,
}

export function M2MConfig() {
  return {
    url: process.env.M2M_AUTH_URL || 'https://topcoder-dev.auth0.com/oauth/token',
    proxyServerUrl: process.env.M2M_AUTH_PROXY_SEREVR_URL || 'https://auth0proxy.topcoder-dev.com/token',
    audience: process.env.M2M_AUTH_AUDIENCE || '',
    domain: process.env.M2M_AUTH_DOMAIN || '',
    clientId: process.env.M2M_AUTH_CLIENT_ID || '',
    clientSecret: process.env.M2M_AUTH_CLIENT_SECRET || '',
    tokenCacheTime: process.env.TOKEN_CACHE_TIME ?? 86400000,
  }
}

export const EventBusConfig = {
  url: process.env.BUSAPI_URL || 'http://localhost:4000/eventBus',
  kafkaErrorTopic: process.env.KAFKA_ERROR_TOPIC ?? 'common.error.reporting',
}

export function AwsS3Config() {
  return {
    endpoint: process.env.AWS_S3_ENDPOINT || 'http://localhost:4566',
    region: process.env.AWS_S3_REGION || 'us-east-1',
    apiVersion: process.env.AWS_S3_API_VERSION || '2006-03-01',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true' || true, // Crucial for LocalStack S3
  }
}

export function SalesforceConfig() {
  return {
    clientAudience: process.env.SALESFORCE_CLIENT_AUDIENCE || 'https://login.salesforce.com',
    clientKey: process.env.SALESFORCE_CLIENT_KEY || 'privateKey',
    clientId: process.env.SALESFORCE_CLIENT_ID || '',
    subject: process.env.SALESFORCE_SUBJECT || '',
    sfdcBillingAccountNameField: process.env.SFDC_BILLING_ACCOUNT_NAME_FIELD || 'Billing_Account_name__c',
    sfdcBillingAccountMarkupField: process.env.SFDC_BILLING_ACCOUNT_MARKUP_FIELD || 'Mark_Up__c',
    sfdcBillingAccountActiveField: process.env.SFDC_BILLING_ACCOUNT_ACTIVE_FIELD || 'Active__c',
  }
}

