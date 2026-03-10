/**
 * Canonical OAuth scope registry for machine-to-machine access.
 *
 * Hierarchy model:
 * - `all:x` implies the matching `read:x` and `write:x` scopes.
 * - Aliases are normalized through `SCOPE_SYNONYMS`.
 */
export enum Scope {
  /**
   * Full Connect Project admin scope.
   */
  CONNECT_PROJECT_ADMIN = 'all:connect_project',
  /**
   * Legacy alias for full Connect Project admin scope.
   *
   * @security Compatibility shim that grants full admin access. Do not issue
   * this alias to new M2M clients.
   */
  CONNECT_PROJECT_ADMIN_ALIAS = 'all:project',

  /**
   * Full project read/write scope.
   */
  PROJECTS_ALL = 'all:projects',
  /**
   * Read projects.
   */
  PROJECTS_READ = 'read:projects',
  /**
   * Create/update/delete projects.
   */
  PROJECTS_WRITE = 'write:projects',
  /**
   * Read billing accounts available to a user for project assignment.
   */
  PROJECTS_READ_USER_BILLING_ACCOUNTS = 'read:user-billing-accounts',
  /**
   * Write project billing account associations.
   */
  PROJECTS_WRITE_PROJECTS_BILLING_ACCOUNTS = 'write:projects-billing-accounts',
  /**
   * Read details of billing accounts already attached to a project.
   */
  PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS = 'read:project-billing-account-details',

  /**
   * Full project-member read/write scope.
   */
  PROJECT_MEMBERS_ALL = 'all:project-members',
  /**
   * Read project members.
   */
  PROJECT_MEMBERS_READ = 'read:project-members',
  /**
   * Create/update/delete project members.
   */
  PROJECT_MEMBERS_WRITE = 'write:project-members',

  /**
   * Full project-invite read/write scope.
   */
  PROJECT_INVITES_ALL = 'all:project-invites',
  /**
   * Read project invites.
   */
  PROJECT_INVITES_READ = 'read:project-invites',
  /**
   * Create/update/delete project invites.
   */
  PROJECT_INVITES_WRITE = 'write:project-invites',

  /**
   * Full customer-payment read/write scope.
   */
  CUSTOMER_PAYMENT_ALL = 'all:customer-payments',
  /**
   * Read customer payments.
   */
  CUSTOMER_PAYMENT_READ = 'read:customer-payments',
  /**
   * Create/update customer payments.
   */
  CUSTOMER_PAYMENT_WRITE = 'write:customer-payments',
}

/**
 * Type-safe aliases used by services and policy constants.
 */
export const M2M_SCOPES = {
  CONNECT_PROJECT_ADMIN: Scope.CONNECT_PROJECT_ADMIN,
  PROJECTS: {
    ALL: Scope.PROJECTS_ALL,
    READ: Scope.PROJECTS_READ,
    WRITE: Scope.PROJECTS_WRITE,
    READ_USER_BILLING_ACCOUNTS: Scope.PROJECTS_READ_USER_BILLING_ACCOUNTS,
    WRITE_PROJECTS_BILLING_ACCOUNTS:
      Scope.PROJECTS_WRITE_PROJECTS_BILLING_ACCOUNTS,
    READ_PROJECT_BILLING_ACCOUNT_DETAILS:
      Scope.PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS,
  },
  PROJECT_MEMBERS: {
    ALL: Scope.PROJECT_MEMBERS_ALL,
    READ: Scope.PROJECT_MEMBERS_READ,
    WRITE: Scope.PROJECT_MEMBERS_WRITE,
  },
  PROJECT_INVITES: {
    ALL: Scope.PROJECT_INVITES_ALL,
    READ: Scope.PROJECT_INVITES_READ,
    WRITE: Scope.PROJECT_INVITES_WRITE,
  },
  CUSTOMER_PAYMENT: {
    ALL: Scope.CUSTOMER_PAYMENT_ALL,
    READ: Scope.CUSTOMER_PAYMENT_READ,
    WRITE: Scope.CUSTOMER_PAYMENT_WRITE,
  },
} as const;

/**
 * Scope set implied by `CONNECT_PROJECT_ADMIN`.
 */
export const ALL_PROJECT_RELATED_SCOPES: Scope[] = [
  Scope.PROJECTS_ALL,
  Scope.PROJECTS_READ,
  Scope.PROJECTS_WRITE,
  Scope.PROJECTS_READ_USER_BILLING_ACCOUNTS,
  Scope.PROJECTS_WRITE_PROJECTS_BILLING_ACCOUNTS,
  Scope.PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS,
  Scope.PROJECT_MEMBERS_ALL,
  Scope.PROJECT_MEMBERS_READ,
  Scope.PROJECT_MEMBERS_WRITE,
  Scope.PROJECT_INVITES_ALL,
  Scope.PROJECT_INVITES_READ,
  Scope.PROJECT_INVITES_WRITE,
  Scope.CUSTOMER_PAYMENT_ALL,
  Scope.CUSTOMER_PAYMENT_READ,
  Scope.CUSTOMER_PAYMENT_WRITE,
];

/**
 * Explicit implication graph for `all:x` scope expansion.
 *
 * Used by `M2MService.hasRequiredScopes`.
 */
export const SCOPE_HIERARCHY: Record<string, Scope[]> = {
  [Scope.PROJECTS_ALL]: [Scope.PROJECTS_READ, Scope.PROJECTS_WRITE],
  [Scope.PROJECT_MEMBERS_ALL]: [
    Scope.PROJECT_MEMBERS_READ,
    Scope.PROJECT_MEMBERS_WRITE,
  ],
  [Scope.PROJECT_INVITES_ALL]: [
    Scope.PROJECT_INVITES_READ,
    Scope.PROJECT_INVITES_WRITE,
  ],
  [Scope.CUSTOMER_PAYMENT_ALL]: [
    Scope.CUSTOMER_PAYMENT_READ,
    Scope.CUSTOMER_PAYMENT_WRITE,
  ],
  [Scope.CONNECT_PROJECT_ADMIN]: ALL_PROJECT_RELATED_SCOPES,
};

/**
 * Legacy alias mappings expanded to canonical scope values.
 */
export const SCOPE_SYNONYMS: Record<string, Scope[]> = {
  [Scope.CONNECT_PROJECT_ADMIN_ALIAS]: [Scope.CONNECT_PROJECT_ADMIN],
};
