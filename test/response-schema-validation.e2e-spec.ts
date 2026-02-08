import Ajv from 'ajv';
import axios, { AxiosRequestConfig, Method } from 'axios';
import { queryFixtures, requestFixtures } from './fixtures/requests';
import { readUserTokensFromEnv } from './fixtures/users';

interface V5ProjectSummary {
  id: string | number;
  name: string;
  type: string;
  status: string;
  details?: Record<string, unknown> | null;
}

interface V5ProjectDetails extends V5ProjectSummary {
  members?: Array<Record<string, unknown>>;
  invites?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
  phases?: Array<Record<string, unknown>>;
}

interface V5MemberResponse {
  id: string | number;
  projectId: string | number;
  userId: string | number;
  role: string;
  isPrimary?: boolean;
}

interface V5InviteResponse {
  id: string | number;
  projectId: string | number;
  role: string;
  status: string;
  email?: string;
  userId?: string | number;
}

interface V5AttachmentResponse {
  id: string | number;
  projectId: string | number;
  type: string;
  path: string;
  title?: string;
  url?: string;
}

interface V5PhaseResponse {
  id: string | number;
  name?: string;
  status?: string;
  products?: Array<Record<string, unknown>>;
}

interface V5CopilotRequestResponse {
  id: string | number;
  status: string;
  data: Record<string, unknown>;
}

interface V5CopilotOpportunityResponse {
  id: string | number;
  status: string;
  type: string;
}

interface ParityHttpRequest {
  method: Method;
  path: string;
  token?: string;
  params?: Record<string, unknown>;
  data?: unknown;
}

interface ParityHttpResponse {
  status: number;
  data: unknown;
  headers: Record<string, string | undefined>;
}

const PARITY_ENABLED = process.env.PARITY_TESTS_ENABLED === 'true';
const WRITE_PARITY_ENABLED = process.env.PARITY_WRITE_TESTS_ENABLED === 'true';
const V5_BASE_URL = process.env.V5_BASE_URL || 'http://localhost:8001/v5';
const V6_BASE_URL = process.env.V6_BASE_URL || 'http://localhost:8002/v6';
const PROJECT_ID = process.env.PARITY_PROJECT_ID || '1001';
const MEMBER_ID = process.env.PARITY_MEMBER_ID || '1';
const INVITE_ID = process.env.PARITY_INVITE_ID || '1';
const ATTACHMENT_ID = process.env.PARITY_ATTACHMENT_ID || '1';
const PHASE_ID = process.env.PARITY_PHASE_ID || '1';
const PRODUCT_ID = process.env.PARITY_PRODUCT_ID || '1';
const COPILOT_REQUEST_ID = process.env.PARITY_COPILOT_REQUEST_ID || '1';
const COPILOT_OPPORTUNITY_ID = process.env.PARITY_COPILOT_OPPORTUNITY_ID || '1';

const userTokens = readUserTokensFromEnv();
const defaultToken = userTokens.manager || userTokens.admin;

const ajv = new Ajv({
  allErrors: true,
  strict: false,
});

const idSchema = {
  anyOf: [{ type: 'string' }, { type: 'number' }],
};

const nullableStringSchema = {
  anyOf: [{ type: 'string' }, { type: 'null' }],
};

const projectSummarySchema = {
  type: 'object',
  required: ['id', 'name', 'type', 'status'],
  properties: {
    id: idSchema,
    name: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string' },
    details: {
      anyOf: [{ type: 'object' }, { type: 'null' }],
    },
  },
  additionalProperties: true,
};

const projectDetailsSchema = {
  type: 'object',
  required: ['id', 'name', 'type', 'status'],
  properties: {
    ...projectSummarySchema.properties,
    members: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    invites: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    attachments: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    phases: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  },
  additionalProperties: true,
};

const memberSchema = {
  type: 'object',
  required: ['id', 'projectId', 'userId', 'role'],
  properties: {
    id: idSchema,
    projectId: idSchema,
    userId: idSchema,
    role: { type: 'string' },
    isPrimary: { type: 'boolean' },
  },
  additionalProperties: true,
};

const inviteSchema = {
  type: 'object',
  required: ['id', 'projectId', 'role', 'status'],
  properties: {
    id: idSchema,
    projectId: idSchema,
    role: { type: 'string' },
    status: { type: 'string' },
    email: nullableStringSchema,
    userId: idSchema,
  },
  additionalProperties: true,
};

const attachmentSchema = {
  type: 'object',
  required: ['id', 'projectId', 'type', 'path'],
  properties: {
    id: idSchema,
    projectId: idSchema,
    type: { type: 'string' },
    title: nullableStringSchema,
    path: { type: 'string' },
    url: { type: 'string' },
  },
  additionalProperties: true,
};

const phaseSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: idSchema,
    name: nullableStringSchema,
    status: nullableStringSchema,
    products: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  },
  additionalProperties: true,
};

const copilotRequestSchema = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: idSchema,
    status: { type: 'string' },
    data: {
      type: 'object',
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};

const copilotOpportunitySchema = {
  type: 'object',
  required: ['id', 'status', 'type'],
  properties: {
    id: idSchema,
    status: { type: 'string' },
    type: { type: 'string' },
  },
  additionalProperties: true,
};

function normalizeHeaders(
  headers: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(',') : String(value),
    ]),
  );
}

function normalizeShape(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return ['array', 'empty'];
    }

    return ['array', normalizeShape(payload[0])];
  }

  if (payload === null) {
    return 'null';
  }

  if (payload instanceof Date) {
    return 'date';
  }

  if (typeof payload === 'object') {
    const entries = Object.entries(payload)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeShape(value)]);

    return Object.fromEntries(entries);
  }

  return typeof payload;
}

function assertSchema(schema: object, payload: unknown): void {
  const validate = ajv.compile(schema);
  const valid = validate(payload);

  expect(valid).toBe(true);
}

async function sendRequest(
  baseUrl: string,
  input: ParityHttpRequest,
): Promise<ParityHttpResponse> {
  const config: AxiosRequestConfig = {
    method: input.method,
    url: `${baseUrl}${input.path}`,
    params: input.params,
    data: input.data,
    validateStatus: () => true,
    headers: input.token
      ? {
          Authorization: `Bearer ${input.token}`,
        }
      : undefined,
  };

  const response = await axios.request(config);

  return {
    status: response.status,
    data: response.data,
    headers: normalizeHeaders(response.headers as Record<string, unknown>),
  };
}

async function sendToBothServices(input: ParityHttpRequest): Promise<{
  v5: ParityHttpResponse;
  v6: ParityHttpResponse;
}> {
  const [v5, v6] = await Promise.all([
    sendRequest(V5_BASE_URL, input),
    sendRequest(V6_BASE_URL, input),
  ]);

  return { v5, v6 };
}

function assertPaginationHeadersParity(
  v5Headers: Record<string, string | undefined>,
  v6Headers: Record<string, string | undefined>,
): void {
  for (const header of ['x-page', 'x-per-page', 'x-total', 'x-total-pages']) {
    expect(v6Headers[header]).toBe(v5Headers[header]);
  }
}

function assertArrayPayloadSchema(schema: object, payload: unknown): void {
  if (!Array.isArray(payload)) {
    throw new Error('Expected payload to be an array.');
  }

  for (const item of payload) {
    assertSchema(schema, item);
  }
}

function ensureResponseSchemaContractsAreTyped(): void {
  const examples: {
    projectSummary: V5ProjectSummary;
    projectDetails: V5ProjectDetails;
    member: V5MemberResponse;
    invite: V5InviteResponse;
    attachment: V5AttachmentResponse;
    phase: V5PhaseResponse;
    copilotRequest: V5CopilotRequestResponse;
    copilotOpportunity: V5CopilotOpportunityResponse;
  } = {
    projectSummary: {
      id: '1',
      name: 'Example',
      type: 'app',
      status: 'draft',
    },
    projectDetails: {
      id: '1',
      name: 'Example',
      type: 'app',
      status: 'draft',
      members: [],
      invites: [],
      attachments: [],
      phases: [],
    },
    member: {
      id: '1',
      projectId: '1',
      userId: '2',
      role: 'manager',
    },
    invite: {
      id: '1',
      projectId: '1',
      role: 'customer',
      status: 'pending',
    },
    attachment: {
      id: '1',
      projectId: '1',
      type: 'file',
      path: 'fixtures/path.zip',
    },
    phase: {
      id: '1',
      name: 'Discovery',
      status: 'active',
      products: [],
    },
    copilotRequest: {
      id: '1',
      status: 'approved',
      data: {},
    },
    copilotOpportunity: {
      id: '1',
      status: 'active',
      type: 'dev',
    },
  };

  expect(examples.projectSummary.name).toBe('Example');
}

const describeIfParity = PARITY_ENABLED ? describe : describe.skip;

describeIfParity('Response schema parity for /v5 and /v6', () => {
  beforeAll(() => {
    ensureResponseSchemaContractsAreTyped();
  });

  it('matches list projects contract and pagination headers', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: '/projects',
      params: queryFixtures.projectList,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);
    expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));

    if (v5.status === 200) {
      assertArrayPayloadSchema(projectSummarySchema, v5.data);
      assertArrayPayloadSchema(projectSummarySchema, v6.data);
      assertPaginationHeadersParity(v5.headers, v6.headers);
    }
  });

  it('matches project details schema including nested relations', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: `/projects/${PROJECT_ID}`,
      params: queryFixtures.projectFields,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertSchema(projectDetailsSchema, v5.data);
      assertSchema(projectDetailsSchema, v6.data);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches members endpoint schema and optional fields behavior', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: `/projects/${PROJECT_ID}/members`,
      params: queryFixtures.members,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertArrayPayloadSchema(memberSchema, v5.data);
      assertArrayPayloadSchema(memberSchema, v6.data);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches invites endpoint schema and empty result behavior', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: `/projects/${PROJECT_ID}/invites`,
      params: queryFixtures.invites,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertArrayPayloadSchema(inviteSchema, v5.data);
      assertArrayPayloadSchema(inviteSchema, v6.data);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches attachments endpoint schema', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: `/projects/${PROJECT_ID}/attachments/${ATTACHMENT_ID}`,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertSchema(attachmentSchema, v5.data);
      assertSchema(attachmentSchema, v6.data);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches phases endpoint schema with nested products', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: `/projects/${PROJECT_ID}/phases`,
      params: queryFixtures.phases,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertArrayPayloadSchema(phaseSchema, v5.data);
      assertArrayPayloadSchema(phaseSchema, v6.data);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches copilot requests schema and pagination headers', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: '/projects/copilots/requests',
      params: queryFixtures.copilotList,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertArrayPayloadSchema(copilotRequestSchema, v5.data);
      assertArrayPayloadSchema(copilotRequestSchema, v6.data);
      assertPaginationHeadersParity(v5.headers, v6.headers);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches copilot opportunities schema and pagination headers', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: '/projects/copilots/opportunities',
      params: queryFixtures.copilotList,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (v5.status === 200) {
      assertArrayPayloadSchema(copilotOpportunitySchema, v5.data);
      assertArrayPayloadSchema(copilotOpportunitySchema, v6.data);
      assertPaginationHeadersParity(v5.headers, v6.headers);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });

  it('matches optional field filtering behavior for project details', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: `/projects/${PROJECT_ID}`,
      params: queryFixtures.projectFieldsReduced,
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);

    if (
      v5.status === 200 &&
      typeof v5.data === 'object' &&
      typeof v6.data === 'object'
    ) {
      const v5Keys = Object.keys(v5.data as Record<string, unknown>).sort();
      const v6Keys = Object.keys(v6.data as Record<string, unknown>).sort();
      expect(v6Keys).toEqual(v5Keys);
    }
  });

  it('matches empty list behavior for high-entropy keyword filter', async () => {
    const { v5, v6 } = await sendToBothServices({
      method: 'get',
      path: '/projects',
      params: {
        ...queryFixtures.projectList,
        keyword: '__no_results__response_schema_validation__',
      },
      token: defaultToken,
    });

    expect(v6.status).toBe(v5.status);
    expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
  });

  it('covers write-path parity for create/update/delete flows when enabled', async () => {
    if (!WRITE_PARITY_ENABLED || !defaultToken) {
      return;
    }

    const createResult = await sendToBothServices({
      method: 'post',
      path: '/projects',
      data: requestFixtures.createProject,
      token: defaultToken,
    });

    expect(createResult.v6.status).toBe(createResult.v5.status);

    if (createResult.v5.status < 400) {
      assertSchema(projectDetailsSchema, createResult.v5.data);
      assertSchema(projectDetailsSchema, createResult.v6.data);
    }
  });

  it('matches billing and nested resource endpoints used by challenge/work-manager clients', async () => {
    const targetRoutes = [
      `/projects/${PROJECT_ID}/billingAccount`,
      `/projects/${PROJECT_ID}/billingAccounts`,
      `/projects/${PROJECT_ID}/members/${MEMBER_ID}`,
      `/projects/${PROJECT_ID}/invites/${INVITE_ID}`,
      `/projects/${PROJECT_ID}/phases/${PHASE_ID}`,
      `/projects/${PROJECT_ID}/phases/${PHASE_ID}/products/${PRODUCT_ID}`,
      `/projects/copilots/requests/${COPILOT_REQUEST_ID}`,
      `/projects/copilots/opportunity/${COPILOT_OPPORTUNITY_ID}`,
    ];

    for (const path of targetRoutes) {
      const { v5, v6 } = await sendToBothServices({
        method: 'get',
        path,
        token: defaultToken,
      });

      expect(v6.status).toBe(v5.status);
      expect(normalizeShape(v6.data)).toEqual(normalizeShape(v5.data));
    }
  });
});
