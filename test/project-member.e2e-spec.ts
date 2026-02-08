import {
  Controller,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ProjectMemberService } from '../src/api/project-member/project-member.service';
import { JwtService, JwtUser } from '../src/shared/modules/global/jwt.service';
import { M2MService } from '../src/shared/modules/global/m2m.service';
import { PrismaService } from '../src/shared/modules/global/prisma.service';
import { ProjectMemberRole } from '../src/shared/enums/projectMemberRole.enum';
import { UserRole } from '../src/shared/enums/userRole.enum';
import { Scope } from '../src/shared/enums/scopes.enum';

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
  },
  'customer-token': {
    userId: '200',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
  'outsider-token': {
    userId: '999',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
};

@Controller('/projects/project-member-test')
class ProjectMemberTestController {
  @Get('/health')
  health() {
    return { ok: true };
  }
}

describe('Project Member endpoints (e2e)', () => {
  let app: INestApplication;

  const projectMemberServiceMock = {
    addMember: jest.fn(),
    updateMember: jest.fn(),
    deleteMember: jest.fn(),
    listMembers: jest.fn(),
    getMember: jest.fn(),
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
            role: ProjectMemberRole.MANAGER,
            isPrimary: true,
            deletedAt: null,
          },
          {
            id: BigInt(2),
            projectId: BigInt(1001),
            userId: BigInt(200),
            role: ProjectMemberRole.CUSTOMER,
            isPrimary: true,
            deletedAt: null,
          },
          {
            id: BigInt(3),
            projectId: BigInt(1001),
            userId: BigInt(300),
            role: ProjectMemberRole.COPILOT,
            isPrimary: true,
            deletedAt: null,
          },
        ];
      }),
    },
    projectMemberInvite: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProjectMemberTestController],
    })
      .overrideProvider(ProjectMemberService)
      .useValue(projectMemberServiceMock)
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

    projectMemberServiceMock.addMember.mockResolvedValue({ id: '11' });
    projectMemberServiceMock.updateMember.mockResolvedValue({ id: '11' });
    projectMemberServiceMock.deleteMember.mockResolvedValue(undefined);
    projectMemberServiceMock.listMembers.mockResolvedValue([{ id: '11' }]);
    projectMemberServiceMock.getMember.mockResolvedValue({ id: '11' });
  });

  it('creates member', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/1001/members')
      .set('Authorization', 'Bearer manager-token')
      .query({ fields: 'handle,email' })
      .send({ role: 'customer' })
      .expect(201);

    expect(projectMemberServiceMock.addMember).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({ role: 'customer' }),
      expect.objectContaining({ userId: '100' }),
      'handle,email',
    );
  });

  it('returns 403 when non-member lists members', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/1001/members')
      .set('Authorization', 'Bearer outsider-token')
      .expect(403);
  });

  it('lists members for project member', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/1001/members')
      .set('Authorization', 'Bearer manager-token')
      .query({ fields: 'handle' })
      .expect(200);

    expect(projectMemberServiceMock.listMembers).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({ fields: 'handle' }),
      expect.objectContaining({ userId: '100' }),
    );
  });

  it('updates member', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/1001/members/11')
      .set('Authorization', 'Bearer manager-token')
      .send({ role: 'manager', action: 'complete-copilot-requests' })
      .expect(200);

    expect(projectMemberServiceMock.updateMember).toHaveBeenCalled();
  });

  it('deletes member', async () => {
    await request(app.getHttpServer())
      .delete('/v6/projects/1001/members/11')
      .set('Authorization', 'Bearer manager-token')
      .expect(204);

    expect(projectMemberServiceMock.deleteMember).toHaveBeenCalled();
  });

  it('rejects m2m token for member list without named permission match', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECT_MEMBERS_READ],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECT_MEMBERS_READ,
      },
    });

    await request(app.getHttpServer())
      .get('/v6/projects/1001/members')
      .set('Authorization', 'Bearer m2m-member-read')
      .expect(403);
  });
});
