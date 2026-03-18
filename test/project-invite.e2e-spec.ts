import {
  Controller,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InviteStatus, ProjectMemberRole } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProjectInviteService } from '../src/api/project-invite/project-invite.service';
import { Scope } from '../src/shared/enums/scopes.enum';
import { JwtService, JwtUser } from '../src/shared/modules/global/jwt.service';
import { M2MService } from '../src/shared/modules/global/m2m.service';
import { PrismaService } from '../src/shared/modules/global/prisma.service';
import { UserRole } from '../src/shared/enums/userRole.enum';

const tokenUsers: Record<string, JwtUser> = {
  'admin-token': {
    userId: '1',
    roles: [UserRole.CONNECT_ADMIN],
    isMachine: false,
  },
  'manager-token': {
    userId: '100',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
    tokenPayload: {
      email: 'manager@topcoder.com',
    },
  },
  'invitee-token': {
    userId: '200',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
    tokenPayload: {
      email: 'invitee@topcoder.com',
    },
  },
};

@Controller('/projects/project-invite-test')
class ProjectInviteTestController {
  @Get('/health')
  health() {
    return { ok: true };
  }
}

describe('Project Invite endpoints (e2e)', () => {
  let app: INestApplication;

  const projectInviteServiceMock = {
    listInvites: jest.fn(),
    createInvites: jest.fn(),
    updateInvite: jest.fn(),
    deleteInvite: jest.fn(),
    getInvite: jest.fn(),
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
      const rawScope = payload?.scope;
      const scopes =
        typeof rawScope === 'string'
          ? rawScope.split(' ').map((scope) => scope.trim().toLowerCase())
          : [];

      return {
        isMachine: payload?.gty === 'client-credentials',
        scopes,
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
      findMany: jest.fn(({ where }: { where: { projectId: bigint } }) => {
        if (where.projectId !== BigInt(1001)) {
          return [];
        }

        return [
          {
            id: BigInt(1),
            projectId: BigInt(1001),
            userId: BigInt(100),
            role: ProjectMemberRole.manager,
            isPrimary: true,
            deletedAt: null,
          },
          {
            id: BigInt(2),
            projectId: BigInt(1001),
            userId: BigInt(300),
            role: ProjectMemberRole.copilot,
            isPrimary: false,
            deletedAt: null,
          },
        ];
      }),
    },
    projectMemberInvite: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: BigInt(10),
          projectId: BigInt(1001),
          userId: BigInt(200),
          email: 'invitee@topcoder.com',
          status: InviteStatus.pending,
          deletedAt: null,
        },
      ]),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProjectInviteTestController],
    })
      .overrideProvider(ProjectInviteService)
      .useValue(projectInviteServiceMock)
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

    projectInviteServiceMock.listInvites.mockResolvedValue([{ id: '1' }]);
    projectInviteServiceMock.createInvites.mockResolvedValue({
      success: [{ id: '1' }],
    });
    projectInviteServiceMock.updateInvite.mockResolvedValue({ id: '1' });
    projectInviteServiceMock.deleteInvite.mockResolvedValue(undefined);
    projectInviteServiceMock.getInvite.mockResolvedValue({ id: '1' });
  });

  it('lists invites', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/1001/invites')
      .set('Authorization', 'Bearer manager-token')
      .query({ fields: 'handle,email' })
      .expect(200);

    expect(projectInviteServiceMock.listInvites).toHaveBeenCalled();
  });

  it('creates invites with 201 status', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/1001/invites')
      .set('Authorization', 'Bearer manager-token')
      .send({ handles: ['member'], role: ProjectMemberRole.customer })
      .expect(201);

    expect(projectInviteServiceMock.createInvites).toHaveBeenCalled();
  });

  it('creates invites for m2m token with project-invite write scope', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECT_INVITES_WRITE],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECT_INVITES_WRITE,
      },
    });

    await request(app.getHttpServer())
      .post('/v6/projects/1001/invites')
      .set('Authorization', 'Bearer m2m-invite-write')
      .send({ handles: ['member'], role: ProjectMemberRole.customer })
      .expect(201);

    expect(projectInviteServiceMock.createInvites).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({ role: ProjectMemberRole.customer }),
      expect.objectContaining({
        scopes: [Scope.PROJECT_INVITES_WRITE],
        isMachine: true,
      }),
      undefined,
    );
  });

  it('returns 201 when at least one invite is created', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECT_INVITES_WRITE],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECT_INVITES_WRITE,
      },
    });

    projectInviteServiceMock.createInvites.mockResolvedValueOnce({
      success: [{ id: '1' }],
      failed: [
        {
          email: 'dilhanigunawardhana+1@gmail.com',
          message: 'Emails can only be used for customer',
        },
      ],
    });

    await request(app.getHttpServer())
      .post('/v6/projects/1001/invites')
      .set('Authorization', 'Bearer m2m-invite-write')
      .send({
        handles: ['sdguntcqa'],
        emails: ['dilhanigunawardhana+1@gmail.com'],
        role: ProjectMemberRole.observer,
      })
      .expect(201);
  });

  it('returns 403 when no invites are created', async () => {
    projectInviteServiceMock.createInvites.mockResolvedValueOnce({
      success: [],
      failed: [
        {
          handle: 'missing-user',
          message: 'Unable to invite user',
        },
      ],
    });

    await request(app.getHttpServer())
      .post('/v6/projects/1001/invites')
      .set('Authorization', 'Bearer manager-token')
      .send({ handles: ['missing-user'], role: ProjectMemberRole.customer })
      .expect(403);
  });

  it('updates invite', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/1001/invites/10')
      .set('Authorization', 'Bearer invitee-token')
      .send({ status: InviteStatus.accepted })
      .expect(200);

    expect(projectInviteServiceMock.updateInvite).toHaveBeenCalled();
  });

  it('updates invite for m2m token with project-invite write scope', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECT_INVITES_WRITE],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECT_INVITES_WRITE,
      },
    });

    await request(app.getHttpServer())
      .patch('/v6/projects/1001/invites/10')
      .set('Authorization', 'Bearer m2m-invite-write')
      .send({ status: InviteStatus.accepted })
      .expect(200);

    expect(projectInviteServiceMock.updateInvite).toHaveBeenCalledWith(
      '1001',
      '10',
      expect.objectContaining({ status: InviteStatus.accepted }),
      expect.objectContaining({
        scopes: [Scope.PROJECT_INVITES_WRITE],
        isMachine: true,
      }),
      undefined,
    );
  });

  it('deletes invite', async () => {
    await request(app.getHttpServer())
      .delete('/v6/projects/1001/invites/10')
      .set('Authorization', 'Bearer invitee-token')
      .expect(204);

    expect(projectInviteServiceMock.deleteInvite).toHaveBeenCalled();
  });

  it('deletes invite for m2m token with project-invite write scope', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECT_INVITES_WRITE],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECT_INVITES_WRITE,
      },
    });

    await request(app.getHttpServer())
      .delete('/v6/projects/1001/invites/10')
      .set('Authorization', 'Bearer m2m-invite-write')
      .expect(204);

    expect(projectInviteServiceMock.deleteInvite).toHaveBeenCalledWith(
      '1001',
      '10',
      expect.objectContaining({
        scopes: [Scope.PROJECT_INVITES_WRITE],
        isMachine: true,
      }),
    );
  });

  it('gets invite', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/1001/invites/10')
      .set('Authorization', 'Bearer invitee-token')
      .expect(200);

    expect(projectInviteServiceMock.getInvite).toHaveBeenCalled();
  });
});
