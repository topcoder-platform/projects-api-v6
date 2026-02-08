import axios, { AxiosRequestConfig, Method } from 'axios';
import { requestFixtures } from './fixtures/requests';
import { readM2MTokensFromEnv, readUserTokensFromEnv } from './fixtures/users';

interface AuthParityRequest {
  name: string;
  method: Method;
  path: string;
  data?: unknown;
  params?: Record<string, unknown>;
  token?: string;
}

interface AuthParityResponse {
  status: number;
  data: unknown;
}

const PARITY_ENABLED = process.env.PARITY_TESTS_ENABLED === 'true';
const AUTH_PARITY_ENABLED =
  process.env.AUTHORIZATION_PARITY_ENABLED !== 'false';
const V5_BASE_URL = process.env.V5_BASE_URL || 'http://localhost:8001/v5';
const V6_BASE_URL = process.env.V6_BASE_URL || 'http://localhost:8002/v6';
const PROJECT_ID = process.env.PARITY_PROJECT_ID || '1001';
const MEMBER_ID = process.env.PARITY_MEMBER_ID || '1';
const COPILOT_MEMBER_ID = process.env.PARITY_PRIMARY_COPILOT_MEMBER_ID;
const INVITE_ID = process.env.PARITY_INVITE_ID || '1';

const userTokens = readUserTokensFromEnv();
const m2mTokens = readM2MTokensFromEnv();

const describeIfParity =
  PARITY_ENABLED && AUTH_PARITY_ENABLED ? describe : describe.skip;

async function callService(
  baseUrl: string,
  request: AuthParityRequest,
): Promise<AuthParityResponse> {
  const config: AxiosRequestConfig = {
    method: request.method,
    url: `${baseUrl}${request.path}`,
    data: request.data,
    params: request.params,
    validateStatus: () => true,
    headers: request.token
      ? {
          Authorization: `Bearer ${request.token}`,
        }
      : undefined,
  };

  const response = await axios.request(config);

  return {
    status: response.status,
    data: response.data,
  };
}

async function callBoth(
  request: AuthParityRequest,
): Promise<{ v5: AuthParityResponse; v6: AuthParityResponse }> {
  const [v5, v6] = await Promise.all([
    callService(V5_BASE_URL, request),
    callService(V6_BASE_URL, request),
  ]);

  return { v5, v6 };
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as {
    message?: string | string[];
    error?: string;
  };

  if (typeof candidate.message === 'string') {
    return candidate.message;
  }

  if (Array.isArray(candidate.message) && candidate.message.length > 0) {
    return String(candidate.message[0]);
  }

  if (typeof candidate.error === 'string') {
    return candidate.error;
  }

  return undefined;
}

function addCaseIfToken(
  cases: AuthParityRequest[],
  baseCase: Omit<AuthParityRequest, 'token'>,
  token?: string,
): void {
  if (!token) {
    return;
  }

  cases.push({
    ...baseCase,
    token,
  });
}

describeIfParity('Authorization parity between /v5 and /v6', () => {
  const roleMatrixCases: AuthParityRequest[] = [];

  beforeAll(() => {
    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'admin can read project',
        method: 'get',
        path: `/projects/${PROJECT_ID}`,
      },
      userTokens.admin,
    );

    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'manager can list members',
        method: 'get',
        path: `/projects/${PROJECT_ID}/members`,
      },
      userTokens.manager,
    );

    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'customer invite create permission check',
        method: 'post',
        path: `/projects/${PROJECT_ID}/invites`,
        data: requestFixtures.inviteByHandle,
      },
      userTokens.customer,
    );

    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'copilot cannot delete members unless permission allows it',
        method: 'delete',
        path: `/projects/${PROJECT_ID}/members/${MEMBER_ID}`,
      },
      userTokens.copilot,
    );

    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'non-member should not list members',
        method: 'get',
        path: `/projects/${PROJECT_ID}/members`,
      },
      userTokens.nonMember,
    );

    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'member role-change restriction parity',
        method: 'patch',
        path: `/projects/${PROJECT_ID}/members/${MEMBER_ID}`,
        data: requestFixtures.updateMemberRole,
      },
      userTokens.member,
    );

    addCaseIfToken(
      roleMatrixCases,
      {
        name: 'invitee can update own invite',
        method: 'patch',
        path: `/projects/${PROJECT_ID}/invites/${INVITE_ID}`,
        data: requestFixtures.acceptInvite,
      },
      userTokens.invitee,
    );
  });

  it.each(roleMatrixCases)('$name', async (testCase) => {
    const { v5, v6 } = await callBoth(testCase);

    expect(v6.status).toBe(v5.status);

    if (v5.status >= 400) {
      const v5Message = extractErrorMessage(v5.data);
      const v6Message = extractErrorMessage(v6.data);

      expect(v6Message).toBe(v5Message);
    }
  });

  it('matches M2M scope behavior for all:project/read:project/write:project tokens', async () => {
    const m2mCases: AuthParityRequest[] = [];

    addCaseIfToken(
      m2mCases,
      {
        name: 'm2m all:project can read project',
        method: 'get',
        path: `/projects/${PROJECT_ID}`,
      },
      m2mTokens.allProject,
    );

    addCaseIfToken(
      m2mCases,
      {
        name: 'm2m read:project can list projects',
        method: 'get',
        path: '/projects',
      },
      m2mTokens.readProject,
    );

    addCaseIfToken(
      m2mCases,
      {
        name: 'm2m write:project can update project',
        method: 'patch',
        path: `/projects/${PROJECT_ID}`,
        data: requestFixtures.updateProject,
      },
      m2mTokens.writeProject,
    );

    for (const testCase of m2mCases) {
      const { v5, v6 } = await callBoth(testCase);
      expect(v6.status).toBe(v5.status);
    }
  });

  it('matches copilot invite flow parity (pending vs requested status)', async () => {
    if (!userTokens.manager) {
      return;
    }

    const handle =
      process.env.PARITY_COPILOT_HANDLE || 'missing-copilot-handle';

    const request: AuthParityRequest = {
      name: 'copilot invite flow',
      method: 'post',
      path: `/projects/${PROJECT_ID}/invites`,
      token: userTokens.manager,
      data: {
        handles: [handle],
        role: 'copilot',
      },
    };

    const { v5, v6 } = await callBoth(request);

    expect(v6.status).toBe(v5.status);
    expect(extractErrorMessage(v6.data)).toBe(extractErrorMessage(v5.data));
  });

  it('matches customer-only email invite restriction', async () => {
    if (!userTokens.manager) {
      return;
    }

    const request: AuthParityRequest = {
      name: 'email invites restricted by role',
      method: 'post',
      path: `/projects/${PROJECT_ID}/invites`,
      token: userTokens.manager,
      data: {
        emails: ['parity.noncustomer@example.com'],
        role: 'manager',
      },
    };

    const { v5, v6 } = await callBoth(request);

    expect(v6.status).toBe(v5.status);
    expect(extractErrorMessage(v6.data)).toBe(extractErrorMessage(v5.data));
  });

  it('matches primary copilot delete + auto-promotion permission behavior', async () => {
    if (!userTokens.manager || !COPILOT_MEMBER_ID) {
      return;
    }

    const request: AuthParityRequest = {
      name: 'delete primary copilot',
      method: 'delete',
      path: `/projects/${PROJECT_ID}/members/${COPILOT_MEMBER_ID}`,
      token: userTokens.manager,
    };

    const { v5, v6 } = await callBoth(request);

    expect(v6.status).toBe(v5.status);
  });

  it('matches unauthorized response when no token is provided', async () => {
    const { v5, v6 } = await callBoth({
      name: 'anonymous get project',
      method: 'get',
      path: `/projects/${PROJECT_ID}`,
    });

    expect(v6.status).toBe(v5.status);
    expect(extractErrorMessage(v6.data)).toBe(extractErrorMessage(v5.data));
  });
});
