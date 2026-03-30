/**
 * Runtime service endpoint configuration.
 */
export const SERVICE_ENDPOINTS = {
  billingAccountsApiUrl: process.env.BILLING_ACCOUNTS_API_URL || '',
  memberApiUrl:
    process.env.MEMBER_API_URL || process.env.MEMBER_SERVICE_ENDPOINT || '',
  identityApiUrl:
    process.env.IDENTITY_API_URL || process.env.IDENTITY_SERVICE_ENDPOINT || '',
};
