import {
  BadRequestException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CopilotApplicationService } from '../src/api/copilot/copilot-application.service';
import { CopilotOpportunityService } from '../src/api/copilot/copilot-opportunity.service';
import { CopilotRequestService } from '../src/api/copilot/copilot-request.service';
import { JwtUser, JwtService } from '../src/shared/modules/global/jwt.service';
import { M2MService } from '../src/shared/modules/global/m2m.service';
import { PrismaService } from '../src/shared/modules/global/prisma.service';
import { Scope } from '../src/shared/enums/scopes.enum';
import { UserRole } from '../src/shared/enums/userRole.enum';

const tokenUsers: Record<string, JwtUser> = {
  'pm-token': {
    userId: '1001',
    roles: [UserRole.PROJECT_MANAGER],
    isMachine: false,
  },
  'admin-token': {
    userId: '1',
    roles: [UserRole.TOPCODER_ADMIN],
    isMachine: false,
  },
  'copilot-token': {
    userId: '3001',
    roles: [UserRole.TC_COPILOT],
    isMachine: false,
  },
  'user-token': {
    userId: '9001',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
};

describe('Copilot endpoints (e2e)', () => {
  let app: INestApplication;

  const copilotRequestServiceMock = {
    listRequests: jest.fn(),
    getRequest: jest.fn(),
    createRequest: jest.fn(),
    updateRequest: jest.fn(),
    approveRequest: jest.fn(),
  };

  const copilotOpportunityServiceMock = {
    listOpportunities: jest.fn(),
    getOpportunity: jest.fn(),
    assignCopilot: jest.fn(),
    cancelOpportunity: jest.fn(),
  };

  const copilotApplicationServiceMock = {
    applyToOpportunity: jest.fn(),
    listApplications: jest.fn(),
  };

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
    validateMachineToken: jest.fn((payload?: Record<string, unknown>) => {
      const rawScope =
        payload?.scope ??
        payload?.scopes ??
        payload?.scp ??
        payload?.permissions;
      const scopes =
        typeof rawScope === 'string'
          ? rawScope.split(/\s+/u).map((scope) => scope.trim().toLowerCase())
          : Array.isArray(rawScope)
            ? rawScope.map((scope) => String(scope).trim().toLowerCase())
            : [];

      return {
        isMachine: payload?.gty === 'client-credentials' || scopes.length > 0,
        scopes: scopes.filter((scope) => scope.length > 0),
      };
    }),
    hasRequiredScopes: jest.fn(
      (tokenScopes: string[], requiredScopes: string[]): boolean => {
        if (requiredScopes.length === 0) {
          return true;
        }

        const normalized = tokenScopes.map((scope) => scope.toLowerCase());

        return requiredScopes.some((scope) =>
          normalized.includes(scope.toLowerCase()),
        );
      },
    ),
  };

  const prismaServiceMock = {
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
    })
      .overrideProvider(CopilotRequestService)
      .useValue(copilotRequestServiceMock)
      .overrideProvider(CopilotOpportunityService)
      .useValue(copilotOpportunityServiceMock)
      .overrideProvider(CopilotApplicationService)
      .useValue(copilotApplicationServiceMock)
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
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    copilotRequestServiceMock.listRequests.mockResolvedValue({
      data: [{ id: '11', status: 'approved' }],
      page: 1,
      perPage: 20,
      total: 1,
    });
    copilotRequestServiceMock.getRequest.mockResolvedValue({
      id: '11',
      status: 'approved',
    });
    copilotRequestServiceMock.createRequest.mockResolvedValue({
      id: '11',
      status: 'approved',
      copilotOpportunity: [{ id: '21', status: 'active', type: 'dev' }],
    });
    copilotRequestServiceMock.updateRequest.mockResolvedValue({
      id: '11',
      status: 'approved',
    });
    copilotRequestServiceMock.approveRequest.mockResolvedValue({
      id: '21',
      status: 'active',
      type: 'dev',
    });

    copilotOpportunityServiceMock.listOpportunities.mockResolvedValue({
      data: [
        { id: '21', status: 'active', type: 'dev', canApplyAsCopilot: true },
      ],
      page: 1,
      perPage: 10,
      total: 1,
    });
    copilotOpportunityServiceMock.getOpportunity.mockResolvedValue({
      id: '21',
      status: 'active',
      type: 'dev',
      canApplyAsCopilot: true,
      members: [],
    });
    copilotOpportunityServiceMock.assignCopilot.mockResolvedValue({ id: '31' });
    copilotOpportunityServiceMock.cancelOpportunity.mockResolvedValue({
      id: '21',
    });

    copilotApplicationServiceMock.applyToOpportunity.mockResolvedValue({
      id: '31',
      opportunityId: '21',
      userId: '3001',
      notes: 'I can help',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    copilotApplicationServiceMock.listApplications.mockImplementation(
      (_id: string, _query: unknown, user: JwtUser) => {
        if (user.roles?.includes(UserRole.PROJECT_MANAGER)) {
          return [
            {
              id: '31',
              opportunityId: '21',
              userId: '3001',
              notes: 'I can help',
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
              existingMembership: {
                role: 'manager',
              },
            },
          ];
        }

        return [
          {
            userId: '3001',
            status: 'pending',
            createdAt: new Date(),
          },
        ];
      },
    );
  });

  it('creates copilot request and auto-creates opportunity', async () => {
    const response = await request(app.getHttpServer())
      .post('/v6/projects/100/copilots/requests')
      .set('Authorization', 'Bearer pm-token')
      .send({
        data: {
          projectId: 100,
          opportunityTitle: 'Need a dev copilot',
          complexity: 'medium',
          requiresCommunication: 'yes',
          paymentType: 'standard',
          projectType: 'dev',
          overview: 'Detailed overview text',
          skills: [{ id: '1', name: 'Node.js' }],
          startDate: '2026-02-01T00:00:00.000Z',
          numWeeks: 4,
          tzRestrictions: 'UTC-5 to UTC+1',
          numHoursPerWeek: 20,
        },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: '11',
      copilotOpportunity: [{ id: '21', status: 'active', type: 'dev' }],
    });
  });

  it('creates copilot request from global path using payload project id', async () => {
    const response = await request(app.getHttpServer())
      .post('/v6/projects/copilots/requests')
      .set('Authorization', 'Bearer pm-token')
      .send({
        data: {
          projectId: 100,
          opportunityTitle: 'Need a dev copilot',
          complexity: 'medium',
          requiresCommunication: 'yes',
          paymentType: 'standard',
          projectType: 'dev',
          overview: 'Detailed overview text',
          skills: [{ id: '1', name: 'Node.js' }],
          startDate: '2026-02-01T00:00:00.000Z',
          numWeeks: 4,
          tzRestrictions: 'UTC-5 to UTC+1',
          numHoursPerWeek: 20,
        },
      })
      .expect(201);

    expect(copilotRequestServiceMock.createRequest).toHaveBeenCalledWith(
      '100',
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 100,
        }),
      }),
      expect.objectContaining({ userId: '1001' }),
    );
    expect(response.body).toMatchObject({
      id: '11',
      copilotOpportunity: [{ id: '21', status: 'active', type: 'dev' }],
    });
  });

  it('lists opportunities with pagination headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/copilots/opportunities')
      .query({ page: 1, pageSize: 10, sort: 'createdAt desc' })
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    expect(response.headers['x-page']).toBe('1');
    expect(response.headers['x-per-page']).toBe('10');
    expect(
      copilotOpportunityServiceMock.listOpportunities,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        page: '1',
        pageSize: '10',
        sort: 'createdAt desc',
      }),
      expect.objectContaining({ userId: '9001' }),
    );
  });

  it('gets one opportunity from plural path', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/copilots/opportunity/21')
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    expect(copilotOpportunityServiceMock.getOpportunity).toHaveBeenCalledWith(
      '21',
      expect.objectContaining({ userId: '9001' }),
    );
    expect(response.body).toMatchObject({
      id: '21',
      status: 'active',
      type: 'dev',
    });
  });

  it('applies to opportunity as copilot', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/copilots/opportunity/21/apply')
      .set('Authorization', 'Bearer copilot-token')
      .send({ notes: 'I can help' })
      .expect(201);

    expect(
      copilotApplicationServiceMock.applyToOpportunity,
    ).toHaveBeenCalledWith(
      '21',
      expect.objectContaining({ notes: 'I can help' }),
      expect.objectContaining({ userId: '3001' }),
    );
  });

  it('lists full applications for project manager', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/copilots/opportunity/21/applications')
      .set('Authorization', 'Bearer pm-token')
      .expect(200);

    expect(response.body[0]).toHaveProperty('notes');
    expect(response.body[0]).toHaveProperty('existingMembership');
  });

  it('lists limited applications for regular user', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/copilots/opportunity/21/applications')
      .set('Authorization', 'Bearer user-token')
      .expect(200);

    expect(response.body[0]).toHaveProperty('userId');
    expect(response.body[0]).toHaveProperty('status');
    expect(response.body[0]).not.toHaveProperty('notes');
  });

  it('assigns copilot application', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/copilots/opportunity/21/assign')
      .set('Authorization', 'Bearer pm-token')
      .send({ applicationId: '31' })
      .expect(200);

    expect(copilotOpportunityServiceMock.assignCopilot).toHaveBeenCalledWith(
      '21',
      expect.objectContaining({ applicationId: '31' }),
      expect.objectContaining({ userId: '1001' }),
    );
  });

  it('cancels opportunity', async () => {
    await request(app.getHttpServer())
      .delete('/v6/projects/copilots/opportunity/21/cancel')
      .set('Authorization', 'Bearer pm-token')
      .expect(200);

    expect(
      copilotOpportunityServiceMock.cancelOpportunity,
    ).toHaveBeenCalledWith('21', expect.objectContaining({ userId: '1001' }));
  });

  it('updates request and returns validation error from service', async () => {
    copilotRequestServiceMock.updateRequest.mockRejectedValueOnce(
      new BadRequestException('cannot be updated'),
    );

    await request(app.getHttpServer())
      .patch('/v6/projects/copilots/requests/11')
      .set('Authorization', 'Bearer pm-token')
      .send({ data: { overview: 'Updated details' } })
      .expect(400);
  });

  it('rejects creating request for non-PM user', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/100/copilots/requests')
      .set('Authorization', 'Bearer user-token')
      .send({
        data: {
          projectId: 100,
          opportunityTitle: 'Need a dev copilot',
          complexity: 'medium',
          requiresCommunication: 'yes',
          paymentType: 'standard',
          projectType: 'dev',
          overview: 'Detailed overview text',
          skills: [{ id: '1', name: 'Node.js' }],
          startDate: '2026-02-01T00:00:00.000Z',
          numWeeks: 4,
          tzRestrictions: 'UTC-5 to UTC+1',
          numHoursPerWeek: 20,
        },
      })
      .expect(403);
  });

  it('rejects creating global request for non-PM user', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/copilots/requests')
      .set('Authorization', 'Bearer user-token')
      .send({
        data: {
          projectId: 100,
          opportunityTitle: 'Need a dev copilot',
          complexity: 'medium',
          requiresCommunication: 'yes',
          paymentType: 'standard',
          projectType: 'dev',
          overview: 'Detailed overview text',
          skills: [{ id: '1', name: 'Node.js' }],
          startDate: '2026-02-01T00:00:00.000Z',
          numWeeks: 4,
          tzRestrictions: 'UTC-5 to UTC+1',
          numHoursPerWeek: 20,
        },
      })
      .expect(403);
  });

  it('rejects applying for non-copilot user', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/copilots/opportunity/21/apply')
      .set('Authorization', 'Bearer user-token')
      .send({ notes: 'I can help' })
      .expect(403);
  });

  it('rejects assigning for copilot user', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/copilots/opportunity/21/assign')
      .set('Authorization', 'Bearer copilot-token')
      .send({ applicationId: '31' })
      .expect(403);
  });

  it('allows m2m token with required scopes to list opportunities', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECTS_READ],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECTS_READ,
      },
    });

    await request(app.getHttpServer())
      .get('/v6/projects/copilots/opportunities')
      .set('Authorization', 'Bearer m2m-token')
      .expect(200);
  });

  it('allows m2m token with all:projects scope to list copilot requests', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECTS_ALL],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        permissions: [Scope.PROJECTS_ALL],
      },
    });

    await request(app.getHttpServer())
      .get('/v6/projects/copilots/requests')
      .set('Authorization', 'Bearer m2m-token')
      .expect(200);
  });

  it('allows m2m token with all:projects scope to create copilot requests', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECTS_ALL],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        permissions: [Scope.PROJECTS_ALL],
      },
    });

    await request(app.getHttpServer())
      .post('/v6/projects/100/copilots/requests')
      .set('Authorization', 'Bearer m2m-token')
      .send({
        data: {
          projectId: 100,
          opportunityTitle: 'Need a dev copilot',
          complexity: 'medium',
          requiresCommunication: 'yes',
          paymentType: 'standard',
          projectType: 'dev',
          overview: 'Detailed overview text',
          skills: [{ id: '1', name: 'Node.js' }],
          startDate: '2026-02-01T00:00:00.000Z',
          numWeeks: 4,
          tzRestrictions: 'UTC-5 to UTC+1',
          numHoursPerWeek: 20,
        },
      })
      .expect(201);
  });

  it('returns same application payload for repeated apply (idempotency)', async () => {
    const first = await request(app.getHttpServer())
      .post('/v6/projects/copilots/opportunity/21/apply')
      .set('Authorization', 'Bearer copilot-token')
      .send({ notes: 'I can help' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/v6/projects/copilots/opportunity/21/apply')
      .set('Authorization', 'Bearer copilot-token')
      .send({ notes: 'I can help' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
  });
});
