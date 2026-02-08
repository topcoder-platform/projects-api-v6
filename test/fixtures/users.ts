export interface UserTokenFixtures {
  admin?: string;
  manager?: string;
  copilot?: string;
  customer?: string;
  member?: string;
  nonMember?: string;
  invitee?: string;
}

export interface M2MTokenFixtures {
  allProject?: string;
  readProject?: string;
  writeProject?: string;
  readMembers?: string;
  writeMembers?: string;
}

export const userFixturePayloads = {
  admin: {
    userId: '1',
    roles: ['administrator', 'connect_admin'],
  },
  manager: {
    userId: '1001',
    roles: ['Topcoder User', 'Project Manager'],
  },
  copilot: {
    userId: '2001',
    roles: ['copilot'],
  },
  customer: {
    userId: '3001',
    roles: ['Topcoder User'],
  },
  member: {
    userId: '4001',
    roles: ['Topcoder User'],
  },
  nonMember: {
    userId: '9999',
    roles: ['Topcoder User'],
  },
} as const;

export const userTokenEnvMap: Record<keyof UserTokenFixtures, string> = {
  admin: 'PARITY_ADMIN_TOKEN',
  manager: 'PARITY_MANAGER_TOKEN',
  copilot: 'PARITY_COPILOT_TOKEN',
  customer: 'PARITY_CUSTOMER_TOKEN',
  member: 'PARITY_MEMBER_TOKEN',
  nonMember: 'PARITY_NON_MEMBER_TOKEN',
  invitee: 'PARITY_INVITEE_TOKEN',
};

export const m2mTokenEnvMap: Record<keyof M2MTokenFixtures, string> = {
  allProject: 'PARITY_M2M_ALL_PROJECT_TOKEN',
  readProject: 'PARITY_M2M_READ_PROJECT_TOKEN',
  writeProject: 'PARITY_M2M_WRITE_PROJECT_TOKEN',
  readMembers: 'PARITY_M2M_READ_MEMBERS_TOKEN',
  writeMembers: 'PARITY_M2M_WRITE_MEMBERS_TOKEN',
};

export function readUserTokensFromEnv(
  source: NodeJS.ProcessEnv = process.env,
): UserTokenFixtures {
  return {
    admin: source[userTokenEnvMap.admin],
    manager: source[userTokenEnvMap.manager],
    copilot: source[userTokenEnvMap.copilot],
    customer: source[userTokenEnvMap.customer],
    member: source[userTokenEnvMap.member],
    nonMember: source[userTokenEnvMap.nonMember],
    invitee: source[userTokenEnvMap.invitee],
  };
}

export function readM2MTokensFromEnv(
  source: NodeJS.ProcessEnv = process.env,
): M2MTokenFixtures {
  return {
    allProject: source[m2mTokenEnvMap.allProject],
    readProject: source[m2mTokenEnvMap.readProject],
    writeProject: source[m2mTokenEnvMap.writeProject],
    readMembers: source[m2mTokenEnvMap.readMembers],
    writeMembers: source[m2mTokenEnvMap.writeMembers],
  };
}

export function hasAtLeastOneUserToken(tokens: UserTokenFixtures): boolean {
  return Boolean(
    tokens.admin ||
    tokens.manager ||
    tokens.copilot ||
    tokens.customer ||
    tokens.member ||
    tokens.nonMember ||
    tokens.invitee,
  );
}
