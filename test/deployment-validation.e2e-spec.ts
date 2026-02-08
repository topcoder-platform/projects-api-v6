import {
  Controller,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { FileService } from '../src/shared/services/file.service';
import { JwtService, JwtUser } from '../src/shared/modules/global/jwt.service';
import { M2MService } from '../src/shared/modules/global/m2m.service';
import { PrismaService } from '../src/shared/modules/global/prisma.service';
import { queryFixtures, requestFixtures } from './fixtures/requests';
import { readUserTokensFromEnv } from './fixtures/users';

const DEPLOYMENT_VALIDATION_ENABLED =
  process.env.DEPLOYMENT_VALIDATION_ENABLED === 'true';
const DEPLOYMENT_SMOKE_ENABLED =
  process.env.DEPLOYMENT_SMOKE_ENABLED === 'true';
const V6_BASE_URL = process.env.V6_BASE_URL || 'http://localhost:8002/v6';

const tokenUsers: Record<string, JwtUser> = {
  'manager-token': {
    userId: '1001',
    roles: ['Topcoder User'],
    isMachine: false,
  },
};

@Controller('/projects/deployment-validation')
class DeploymentValidationTestController {
  @Get('/health')
  health() {
    return { ok: true };
  }
}

describe('Deployment validation', () => {
  let app: INestApplication;
  const userTokens = readUserTokensFromEnv();
  const smokeToken = userTokens.manager || userTokens.admin;
  let smokeProjectId: string | undefined;

  const jwtServiceMock = {
    validateToken: jest.fn((token: string) => {
      const user = tokenUsers[token];
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return user;
    }),
  };

  const m2mServiceMock = {
    validateMachineToken: jest.fn(() => ({
      isMachine: false,
      scopes: [],
    })),
    hasRequiredScopes: jest.fn(() => true),
  };

  const prismaServiceMock = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    },
    projectMember: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    projectMemberInvite: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [DeploymentValidationTestController],
    })
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .overrideProvider(M2MService)
      .useValue(m2mServiceMock)
      .overrideProvider(PrismaService)
      .useValue(prismaServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v6');
    await app.init();
  });

  afterAll(async () => {
    if (
      DEPLOYMENT_VALIDATION_ENABLED &&
      DEPLOYMENT_SMOKE_ENABLED &&
      smokeProjectId &&
      smokeToken
    ) {
      await callLiveService({
        method: 'delete',
        path: `/projects/${smokeProjectId}`,
        token: smokeToken,
      });
    }

    await app.close();
  });

  it('returns health check response with checksRun in local deployment validation harness', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/health')
      .expect(200);

    expect(response.body).toHaveProperty('checksRun');
  });

  it('validates required environment variables in deployment mode', () => {
    if (!DEPLOYMENT_VALIDATION_ENABLED) {
      return;
    }

    const required = [
      'DATABASE_URL',
      'AUTH0_URL',
      'AUTH0_AUDIENCE',
      'AUTH0_CLIENT_ID',
      'AUTH0_CLIENT_SECRET',
      'KAFKA_URL',
    ];

    const missing = required.filter((key) => !process.env[key]);

    expect(missing).toEqual([]);
  });

  it('validates Kafka client initialization in deployment mode', async () => {
    if (!DEPLOYMENT_VALIDATION_ENABLED) {
      return;
    }

    const eventUtils = await import('../src/shared/utils/event.utils');
    const client = await eventUtils.getBusApiClient();
    expect(client).toBeDefined();
  });

  it('validates presigned url generation in deployment mode', async () => {
    if (!DEPLOYMENT_VALIDATION_ENABLED) {
      return;
    }

    const fixtureBucket = process.env.DEPLOYMENT_VALIDATION_S3_BUCKET;

    if (!fixtureBucket) {
      return;
    }

    const fileService = new FileService();
    const url = await fileService.getPresignedDownloadUrl(
      fixtureBucket,
      'deployment-validation/example.zip',
    );

    expect(url).toContain('X-Amz-Signature');
  });

  it('validates external service connectivity in deployment mode', async () => {
    if (!DEPLOYMENT_VALIDATION_ENABLED) {
      return;
    }

    const targets = [
      process.env.IDENTITY_API_URL,
      process.env.MEMBER_API_URL,
      process.env.BILLING_ACCOUNT_SERVICE_URL,
    ].filter((value): value is string => Boolean(value));

    for (const endpoint of targets) {
      const response = await axios.get(endpoint, {
        timeout: 10000,
        validateStatus: () => true,
      });

      expect(response.status).toBeLessThan(500);
    }
  });

  it('runs smoke tests against deployed service when enabled', async () => {
    if (
      !DEPLOYMENT_VALIDATION_ENABLED ||
      !DEPLOYMENT_SMOKE_ENABLED ||
      !smokeToken
    ) {
      return;
    }

    const createProject = await callLiveService({
      method: 'post',
      path: '/projects',
      token: smokeToken,
      data: requestFixtures.createProject,
    });

    expect([201, 409]).toContain(createProject.status);

    if (createProject.status !== 201) {
      return;
    }

    smokeProjectId = readId(createProject.data);

    if (!smokeProjectId) {
      throw new Error('Smoke project creation did not return an id.');
    }

    const addMember = await callLiveService({
      method: 'post',
      path: `/projects/${smokeProjectId}/members`,
      token: smokeToken,
      params: queryFixtures.members,
      data: requestFixtures.addMember,
    });
    expect([201, 409]).toContain(addMember.status);

    const attachment = await callLiveService({
      method: 'post',
      path: `/projects/${smokeProjectId}/attachments`,
      token: smokeToken,
      data: requestFixtures.createLinkAttachment,
    });
    expect(attachment.status).toBe(201);

    const phase = await callLiveService({
      method: 'post',
      path: `/projects/${smokeProjectId}/phases`,
      token: smokeToken,
      data: requestFixtures.createPhase,
    });
    expect(phase.status).toBe(201);

    const phaseId = readId(phase.data);

    if (!phaseId) {
      throw new Error('Smoke phase creation did not return an id.');
    }

    const phaseProduct = await callLiveService({
      method: 'post',
      path: `/projects/${smokeProjectId}/phases/${phaseId}/products`,
      token: smokeToken,
      data: requestFixtures.createPhaseProduct,
    });
    expect([201, 409]).toContain(phaseProduct.status);
  });

  it('validates deployment event + monitoring endpoints when configured', async () => {
    if (!DEPLOYMENT_VALIDATION_ENABLED) {
      return;
    }

    const monitoringEndpoint = process.env.MONITORING_DEPLOYMENT_EVENT_URL;
    const metricsEndpoint = process.env.MONITORING_METRICS_URL;
    const logsEndpoint = process.env.MONITORING_LOGS_URL;

    if (monitoringEndpoint) {
      const deploymentEvent = await axios.post(
        monitoringEndpoint,
        {
          service: 'project-service-v6',
          timestamp: new Date().toISOString(),
          environment:
            process.env.DEPLOY_ENV || process.env.NODE_ENV || 'unknown',
        },
        {
          timeout: 10000,
          validateStatus: () => true,
        },
      );

      expect(deploymentEvent.status).toBeLessThan(500);
    }

    for (const endpoint of [metricsEndpoint, logsEndpoint]) {
      if (!endpoint) {
        continue;
      }

      const response = await axios.get(endpoint, {
        timeout: 10000,
        validateStatus: () => true,
      });

      expect(response.status).toBeLessThan(500);
    }
  });
});

interface LiveRequest {
  method: Method;
  path: string;
  token?: string;
  data?: unknown;
  params?: Record<string, unknown>;
}

async function callLiveService(request: LiveRequest): Promise<AxiosResponse> {
  const config: AxiosRequestConfig = {
    method: request.method,
    url: `${V6_BASE_URL}${request.path}`,
    headers: request.token
      ? {
          Authorization: `Bearer ${request.token}`,
        }
      : undefined,
    data: request.data,
    params: request.params,
    validateStatus: () => true,
  };

  return axios.request(config);
}

function readId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const id = (payload as { id?: string | number }).id;

  if (typeof id === 'string') {
    return id;
  }

  if (typeof id === 'number') {
    return String(id);
  }

  return undefined;
}
