import axios from 'axios';
import autocannon, { Options, Result } from 'autocannon';
import { queryFixtures, requestFixtures } from '../fixtures/requests';
import { readUserTokensFromEnv } from '../fixtures/users';

const LOAD_TESTS_ENABLED = process.env.LOAD_TESTS_ENABLED === 'true';
const LOAD_INCLUDE_WRITES = process.env.LOAD_INCLUDE_WRITES === 'true';
const LOAD_BASE_URL =
  process.env.LOAD_TEST_BASE_URL || 'http://localhost:8002/v6';
const LOAD_DURATION_SECONDS = Number(
  process.env.LOAD_TEST_DURATION_SECONDS || 10,
);
const LOAD_TIMEOUT_MS = Number(process.env.LOAD_TEST_TIMEOUT_MS || 60000);
const LOAD_PROJECT_ID = process.env.PARITY_PROJECT_ID || '1001';
const LOAD_PHASE_ID = process.env.PARITY_PHASE_ID || '1';

const userTokens = readUserTokensFromEnv();
const loadToken = userTokens.manager || userTokens.admin;

const describeIfLoad = LOAD_TESTS_ENABLED ? describe : describe.skip;

interface LoadScenario {
  name: string;
  options: Options;
}

function runAutocannon(options: Options): Promise<Result> {
  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) => {
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      resolve(result);
    });
  });
}

function assertPerformanceBudget(result: Result, scenarioName: string): void {
  const p95BudgetMs = Number(process.env.LOAD_TEST_P95_BUDGET_MS || 2500);
  const errorRateBudget = Number(
    process.env.LOAD_TEST_ERROR_RATE_BUDGET || 0.05,
  );
  const p95Approximation = result.latency.p97_5;

  expect(p95Approximation).toBeLessThanOrEqual(p95BudgetMs);
  expect(
    result.errors / Math.max(result.requests.total, 1),
  ).toBeLessThanOrEqual(errorRateBudget);

  const p50 = result.latency.p50;
  const p95 = p95Approximation;
  const p99 = result.latency.p99;
  const throughput = result.requests.average;

  console.log(
    `[load] ${scenarioName} p50=${p50}ms p95=${p95}ms p99=${p99}ms rps=${throughput.toFixed(2)} errors=${result.errors}`,
  );
}

async function probeDatasetSize(): Promise<void> {
  if (!loadToken) {
    return;
  }

  const response = await axios.get(`${LOAD_BASE_URL}/projects`, {
    headers: {
      Authorization: `Bearer ${loadToken}`,
    },
    params: {
      page: 1,
      perPage: 1,
      sort: 'lastActivityAt desc',
    },
    validateStatus: () => true,
  });

  expect(response.status).toBe(200);

  const total = Number(response.headers['x-total'] || 0);
  const expected = Number(process.env.LOAD_TEST_EXPECTED_MIN_PROJECTS || 10000);

  expect(total).toBeGreaterThanOrEqual(expected);
}

async function validateMetricsEndpointHealth(): Promise<void> {
  const metricsUrl = process.env.LOAD_METRICS_ENDPOINT;

  if (!metricsUrl) {
    return;
  }

  const response = await axios.get(metricsUrl, {
    timeout: LOAD_TIMEOUT_MS,
    validateStatus: () => true,
  });

  expect(response.status).toBeLessThan(500);
}

describeIfLoad('Performance and load validation', () => {
  jest.setTimeout(LOAD_TIMEOUT_MS * 4);

  it('validates production-like dataset size assumptions', async () => {
    await probeDatasetSize();
  });

  it('runs concurrent read scenarios for project listing and project details', async () => {
    if (!loadToken) {
      return;
    }

    const scenarios: LoadScenario[] = [
      {
        name: 'list projects (100 concurrent)',
        options: {
          url: `${LOAD_BASE_URL}/projects`,
          connections: 100,
          duration: LOAD_DURATION_SECONDS,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${loadToken}`,
          },
          requests: [
            {
              method: 'GET',
              path: `/projects?page=${queryFixtures.projectList.page}&perPage=${queryFixtures.projectList.perPage}&sort=${encodeURIComponent(String(queryFixtures.projectList.sort))}`,
            },
          ],
        },
      },
      {
        name: 'get project by id (200 concurrent)',
        options: {
          url: `${LOAD_BASE_URL}/projects/${LOAD_PROJECT_ID}`,
          connections: 200,
          duration: LOAD_DURATION_SECONDS,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${loadToken}`,
          },
          requests: [
            {
              method: 'GET',
              path: `/projects/${LOAD_PROJECT_ID}?fields=members,invites,attachments`,
            },
          ],
        },
      },
    ];

    for (const scenario of scenarios) {
      const result = await runAutocannon(scenario.options);
      assertPerformanceBudget(result, scenario.name);
    }
  });

  it('runs concurrent write scenarios for create/update/member/attachment/phase operations', async () => {
    if (!LOAD_INCLUDE_WRITES || !loadToken) {
      return;
    }

    const createProjectScenario: LoadScenario = {
      name: 'create project (50 concurrent)',
      options: {
        url: `${LOAD_BASE_URL}/projects`,
        connections: 50,
        duration: LOAD_DURATION_SECONDS,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${loadToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          ...requestFixtures.createProject,
          name: `${requestFixtures.createProject.name}-${Date.now()}`,
        }),
      },
    };

    const updateProjectScenario: LoadScenario = {
      name: 'update project (100 concurrent)',
      options: {
        url: `${LOAD_BASE_URL}/projects/${LOAD_PROJECT_ID}`,
        connections: 100,
        duration: LOAD_DURATION_SECONDS,
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${loadToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestFixtures.updateProject),
      },
    };

    const addMemberScenario: LoadScenario = {
      name: 'member operations (50 concurrent)',
      options: {
        url: `${LOAD_BASE_URL}/projects/${LOAD_PROJECT_ID}/members`,
        connections: 50,
        duration: LOAD_DURATION_SECONDS,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${loadToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestFixtures.addMember),
      },
    };

    const attachmentScenario: LoadScenario = {
      name: 'attachment operations (30 concurrent)',
      options: {
        url: `${LOAD_BASE_URL}/projects/${LOAD_PROJECT_ID}/attachments`,
        connections: 30,
        duration: LOAD_DURATION_SECONDS,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${loadToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestFixtures.createLinkAttachment),
      },
    };

    const phaseScenario: LoadScenario = {
      name: 'phase/product operations (40 concurrent)',
      options: {
        url: `${LOAD_BASE_URL}/projects/${LOAD_PROJECT_ID}/phases/${LOAD_PHASE_ID}/products`,
        connections: 40,
        duration: LOAD_DURATION_SECONDS,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${loadToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestFixtures.createPhaseProduct),
      },
    };

    for (const scenario of [
      createProjectScenario,
      updateProjectScenario,
      addMemberScenario,
      attachmentScenario,
      phaseScenario,
    ]) {
      const result = await runAutocannon(scenario.options);
      assertPerformanceBudget(result, scenario.name);
    }
  });

  it('captures metrics endpoint health for connection pool and memory probes when available', async () => {
    await validateMetricsEndpointHealth();
  });
});
