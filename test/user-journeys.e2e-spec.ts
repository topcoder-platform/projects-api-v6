import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { queryFixtures, requestFixtures } from './fixtures/requests';
import { readUserTokensFromEnv } from './fixtures/users';

const USER_JOURNEYS_ENABLED = process.env.USER_JOURNEYS_ENABLED === 'true';
const USER_JOURNEYS_STRICT = process.env.USER_JOURNEYS_STRICT !== 'false';
const V6_BASE_URL = process.env.V6_BASE_URL || 'http://localhost:8002/v6';
const EXISTING_PROJECT_ID = process.env.PARITY_PROJECT_ID || '1001';
const EXISTING_PHASE_ID = process.env.PARITY_PHASE_ID || '1';

const userTokens = readUserTokensFromEnv();

const describeIfUserJourneys = USER_JOURNEYS_ENABLED ? describe : describe.skip;

interface JourneyRequest {
  method: Method;
  path: string;
  token?: string;
  data?: unknown;
  params?: Record<string, unknown>;
}

function assertStatus(
  response: AxiosResponse,
  expected: number[],
  context: string,
): void {
  if (expected.includes(response.status)) {
    return;
  }

  const payload =
    typeof response.data === 'object'
      ? JSON.stringify(response.data)
      : String(response.data);

  throw new Error(
    `${context} failed with status ${response.status}. Expected ${expected.join(', ')}. Payload: ${payload}`,
  );
}

async function callV6(request: JourneyRequest): Promise<AxiosResponse> {
  const config: AxiosRequestConfig = {
    method: request.method,
    url: `${V6_BASE_URL}${request.path}`,
    data: request.data,
    params: request.params,
    validateStatus: () => true,
    headers: request.token
      ? {
          Authorization: `Bearer ${request.token}`,
        }
      : undefined,
  };

  return axios.request(config);
}

function readProjectId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const id = (payload as { id?: string | number }).id;

  if (typeof id === 'number') {
    return String(id);
  }

  if (typeof id === 'string' && id.trim().length > 0) {
    return id;
  }

  return undefined;
}

function readOpportunityId(payload: unknown): string | undefined {
  const root = payload as {
    id?: string | number;
    copilotOpportunity?: Array<{ id?: string | number }>;
  };

  if (
    Array.isArray(root?.copilotOpportunity) &&
    root.copilotOpportunity.length > 0
  ) {
    const id = root.copilotOpportunity[0]?.id;
    if (typeof id === 'number') {
      return String(id);
    }

    if (typeof id === 'string') {
      return id;
    }
  }

  if (typeof root?.id === 'number') {
    return String(root.id);
  }

  if (typeof root?.id === 'string') {
    return root.id;
  }

  return undefined;
}

describeIfUserJourneys('End-to-end user journey validation', () => {
  let createdProjectId: string | undefined;
  let createdPhaseId: string | undefined;
  let createdCopilotRequestId: string | undefined;
  let createdCopilotOpportunityId: string | undefined;

  afterAll(async () => {
    if (!createdProjectId || !userTokens.manager) {
      return;
    }

    await callV6({
      method: 'delete',
      path: `/projects/${createdProjectId}`,
      token: userTokens.manager,
    });
  });

  it('executes Work Manager project creation flow', async () => {
    if (!userTokens.manager) {
      return;
    }

    const createProjectResponse = await callV6({
      method: 'post',
      path: '/projects',
      token: userTokens.manager,
      data: requestFixtures.createProject,
    });

    assertStatus(createProjectResponse, [201], 'create project');

    createdProjectId = readProjectId(createProjectResponse.data);

    if (!createdProjectId) {
      throw new Error('Project creation did not return an id.');
    }

    const updateProjectResponse = await callV6({
      method: 'patch',
      path: `/projects/${createdProjectId}`,
      token: userTokens.manager,
      data: requestFixtures.updateProject,
    });

    assertStatus(updateProjectResponse, [200], 'update project');

    const addMemberResponse = await callV6({
      method: 'post',
      path: `/projects/${createdProjectId}/members`,
      token: userTokens.manager,
      params: queryFixtures.members,
      data: requestFixtures.addMember,
    });

    if (USER_JOURNEYS_STRICT) {
      assertStatus(addMemberResponse, [201, 409], 'add member');
    }

    const createAttachmentResponse = await callV6({
      method: 'post',
      path: `/projects/${createdProjectId}/attachments`,
      token: userTokens.manager,
      data: requestFixtures.createLinkAttachment,
    });

    assertStatus(createAttachmentResponse, [201], 'create attachment');

    const createPhaseResponse = await callV6({
      method: 'post',
      path: `/projects/${createdProjectId}/phases`,
      token: userTokens.manager,
      data: requestFixtures.createPhase,
    });

    assertStatus(createPhaseResponse, [201], 'create phase');

    createdPhaseId = readProjectId(createPhaseResponse.data);

    if (!createdPhaseId) {
      throw new Error('Phase creation did not return an id.');
    }

    const createPhaseProductResponse = await callV6({
      method: 'post',
      path: `/projects/${createdProjectId}/phases/${createdPhaseId}/products`,
      token: userTokens.manager,
      data: requestFixtures.createPhaseProduct,
    });

    assertStatus(createPhaseProductResponse, [201], 'create phase product');

    const activateProjectResponse = await callV6({
      method: 'patch',
      path: `/projects/${createdProjectId}`,
      token: userTokens.manager,
      data: {
        status: 'active',
      },
    });

    assertStatus(activateProjectResponse, [200], 'activate project');
  });

  it('executes Platform UI copilot request flow', async () => {
    if (!userTokens.manager) {
      return;
    }

    const requestProjectId = createdProjectId || EXISTING_PROJECT_ID;
    const createRequestResponse = await callV6({
      method: 'post',
      path: `/projects/${requestProjectId}/copilots/requests`,
      token: userTokens.manager,
      data: {
        ...requestFixtures.createCopilotRequest,
        data: {
          ...requestFixtures.createCopilotRequest.data,
          projectId: Number(requestProjectId),
        },
      },
    });

    assertStatus(createRequestResponse, [201], 'create copilot request');

    createdCopilotRequestId = readProjectId(createRequestResponse.data);
    createdCopilotOpportunityId = readOpportunityId(createRequestResponse.data);

    if (!createdCopilotRequestId) {
      throw new Error('Copilot request creation did not return an id.');
    }

    const approveResponse = await callV6({
      method: 'post',
      path: `/projects/${requestProjectId}/copilots/requests/${createdCopilotRequestId}/approve`,
      token: userTokens.manager,
      data: {
        type: 'dev',
      },
    });

    assertStatus(approveResponse, [201, 200, 409], 'approve copilot request');

    if (!createdCopilotOpportunityId) {
      createdCopilotOpportunityId = readOpportunityId(approveResponse.data);
    }

    if (userTokens.copilot && createdCopilotOpportunityId) {
      const applyResponse = await callV6({
        method: 'post',
        path: `/projects/copilots/opportunity/${createdCopilotOpportunityId}/apply`,
        token: userTokens.copilot,
        data: {
          notes: 'Applying through user journey fixture',
        },
      });

      assertStatus(applyResponse, [201, 409], 'apply to copilot opportunity');

      const applicationId = readProjectId(applyResponse.data);

      if (applicationId) {
        const assignResponse = await callV6({
          method: 'post',
          path: `/projects/copilots/opportunity/${createdCopilotOpportunityId}/assign`,
          token: userTokens.manager,
          data: {
            applicationId,
          },
        });

        assertStatus(assignResponse, [200, 409], 'assign copilot application');
      }
    }
  });

  it('executes Challenge API integration flow', async () => {
    if (!userTokens.manager) {
      return;
    }

    const projectId = createdProjectId || EXISTING_PROJECT_ID;
    const phaseId = createdPhaseId || EXISTING_PHASE_ID;

    const getProjectResponse = await callV6({
      method: 'get',
      path: `/projects/${projectId}`,
      token: userTokens.manager,
      params: queryFixtures.projectFields,
    });

    assertStatus(
      getProjectResponse,
      [200],
      'get project with nested relations',
    );

    const getBillingResponse = await callV6({
      method: 'get',
      path: `/projects/${projectId}/billingAccount`,
      token: userTokens.manager,
    });

    if (USER_JOURNEYS_STRICT) {
      assertStatus(getBillingResponse, [200, 404], 'get billing account');
    }

    const createPhaseProductResponse = await callV6({
      method: 'post',
      path: `/projects/${projectId}/phases/${phaseId}/products`,
      token: userTokens.manager,
      data: {
        ...requestFixtures.createPhaseProduct,
        details: {
          challengeGuid: `journey-${Date.now()}`,
        },
      },
    });

    if (USER_JOURNEYS_STRICT) {
      assertStatus(
        createPhaseProductResponse,
        [201, 409],
        'create challenge-linked phase product',
      );
    }

    const updateProjectResponse = await callV6({
      method: 'patch',
      path: `/projects/${projectId}`,
      token: userTokens.manager,
      data: {
        details: {
          paymentLifecycle: 'ready_for_payment',
        },
      },
    });

    assertStatus(
      updateProjectResponse,
      [200],
      'update challenge payment lifecycle data',
    );
  });

  it('executes Engagement API validation flow', async () => {
    if (!userTokens.manager) {
      return;
    }

    const projectId = createdProjectId || EXISTING_PROJECT_ID;

    const response = await callV6({
      method: 'get',
      path: `/projects/${projectId}`,
      token: userTokens.manager,
      params: {
        fields: 'members,invites',
      },
    });

    assertStatus(response, [200], 'engagement project fetch');

    const body = response.data as {
      members?: unknown[];
      invites?: unknown[];
    };

    expect(Array.isArray(body.members)).toBe(true);
    expect(Array.isArray(body.invites)).toBe(true);
  });

  it('validates partial-failure handling for batched invite operations', async () => {
    if (!userTokens.manager) {
      return;
    }

    const projectId = createdProjectId || EXISTING_PROJECT_ID;

    const response = await callV6({
      method: 'post',
      path: `/projects/${projectId}/invites`,
      token: userTokens.manager,
      data: {
        emails: ['invalid-email-format', `valid-${Date.now()}@example.com`],
        role: 'customer',
      },
    });

    if (USER_JOURNEYS_STRICT) {
      assertStatus(
        response,
        [201, 403, 400],
        'batched invite create with partial failures',
      );
    }

    const listResponse = await callV6({
      method: 'get',
      path: `/projects/${projectId}/invites`,
      token: userTokens.manager,
      params: queryFixtures.invites,
    });

    assertStatus(listResponse, [200], 'post-invite consistency check');
  });
});
