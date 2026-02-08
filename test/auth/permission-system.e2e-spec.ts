import {
  Controller,
  Get,
  INestApplication,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ProjectMembers } from '../../src/shared/decorators/projectMembers.decorator';
import { RequirePermission } from '../../src/shared/decorators/requirePermission.decorator';
import { PERMISSION } from '../../src/shared/constants/permissions.constants';
import { ProjectMemberRole } from '../../src/shared/enums/projectMemberRole.enum';
import { Scope } from '../../src/shared/enums/scopes.enum';
import { UserRole } from '../../src/shared/enums/userRole.enum';
import { AdminOnlyGuard } from '../../src/shared/guards/adminOnly.guard';
import { PermissionGuard } from '../../src/shared/guards/permission.guard';
import { ProjectMemberGuard } from '../../src/shared/guards/projectMember.guard';
import { ProjectMember } from '../../src/shared/interfaces/permission.interface';
import {
  JwtUser,
  JwtService,
} from '../../src/shared/modules/global/jwt.service';
import { M2MService } from '../../src/shared/modules/global/m2m.service';
import { PrismaService } from '../../src/shared/modules/global/prisma.service';

const tokenUsers: Record<string, JwtUser> = {
  'admin-token': {
    userId: '1',
    roles: [UserRole.CONNECT_ADMIN],
    isMachine: false,
  },
  'user-token': {
    userId: '2',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
  'member-token': {
    userId: '123',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
  'non-member-token': {
    userId: '999',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
  'm2m-good-token': {
    scopes: [Scope.PROJECTS_READ],
    isMachine: true,
    tokenPayload: {
      gty: 'client-credentials',
      scope: Scope.PROJECTS_READ,
    },
  },
  'm2m-bad-token': {
    scopes: [Scope.PROJECT_MEMBERS_READ],
    isMachine: true,
    tokenPayload: {
      gty: 'client-credentials',
      scope: Scope.PROJECT_MEMBERS_READ,
    },
  },
};

const allowRuleWithDenyRule = {
  allowRule: {
    topcoderRoles: true,
  },
  denyRule: {
    topcoderRoles: [UserRole.TOPCODER_USER],
  },
};

@Controller('/projects/permission-system')
class PermissionSystemController {
  @Get('/admin')
  @UseGuards(AdminOnlyGuard)
  adminOnly() {
    return {
      ok: true,
    };
  }

  @Get('/:projectId/member')
  @UseGuards(ProjectMemberGuard)
  memberOnly() {
    return {
      ok: true,
    };
  }

  @Get('/:projectId/project-access')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION.READ_PROJECT)
  projectAccess() {
    return {
      ok: true,
    };
  }

  @Get('/scope-access')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION.READ_PROJECT_ANY)
  scopeAccess() {
    return {
      ok: true,
    };
  }

  @Get('/allow-deny')
  @UseGuards(PermissionGuard)
  @RequirePermission(allowRuleWithDenyRule)
  allowDeny() {
    return {
      ok: true,
    };
  }

  @Get('/:projectId/context')
  context(@ProjectMembers() projectMembers: ProjectMember[]) {
    return {
      memberCount: projectMembers.length,
      roles: projectMembers.map((projectMember) => projectMember.role),
    };
  }
}

describe('Permission system (e2e)', () => {
  let app: INestApplication;

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
    validateMachineToken: jest.fn(
      (payload: Record<string, unknown> | undefined) => {
        const rawScope = payload?.scope;
        const scopes =
          typeof rawScope === 'string'
            ? rawScope.split(' ').map((scope) => scope.trim().toLowerCase())
            : [];

        return {
          isMachine: payload?.gty === 'client-credentials',
          scopes,
        };
      },
    ),
    hasRequiredScopes: jest.fn(
      (tokenScopes: string[], requiredScopes: string[]) => {
        const normalizedTokenScopes = tokenScopes.map((scope) =>
          scope.toLowerCase(),
        );
        const normalizedRequiredScopes = requiredScopes.map((scope) =>
          scope.toLowerCase(),
        );

        if (
          normalizedTokenScopes.includes(Scope.CONNECT_PROJECT_ADMIN) ||
          normalizedTokenScopes.includes(Scope.CONNECT_PROJECT_ADMIN_ALIAS)
        ) {
          return true;
        }

        if (normalizedTokenScopes.includes(Scope.PROJECTS_ALL)) {
          normalizedTokenScopes.push(Scope.PROJECTS_READ, Scope.PROJECTS_WRITE);
        }

        return normalizedRequiredScopes.some((requiredScope) =>
          normalizedTokenScopes.includes(requiredScope),
        );
      },
    ),
  };

  const prismaServiceMock = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    },
    projectMember: {
      findMany: jest.fn(({ where }: { where: { projectId: bigint } }) => {
        if (where.projectId === BigInt(10) || where.projectId === BigInt(777)) {
          return [
            {
              id: BigInt(1),
              projectId: where.projectId,
              userId: BigInt(123),
              role: ProjectMemberRole.MANAGER,
              isPrimary: true,
              deletedAt: null,
            },
            {
              id: BigInt(2),
              projectId: where.projectId,
              userId: BigInt(321),
              role: ProjectMemberRole.COPILOT,
              isPrimary: false,
              deletedAt: null,
            },
          ];
        }

        return [];
      }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [PermissionSystemController],
      providers: [AdminOnlyGuard, ProjectMemberGuard, PermissionGuard],
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
    await app.close();
  });

  it('allows admin role to access admin endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/admin')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
  });

  it('returns 403 for non-admin role on admin endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/admin')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
  });

  it('allows project member to access project member endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/10/member')
      .set('Authorization', 'Bearer member-token')
      .expect(200);
  });

  it('returns 403 for non-member on project member endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/10/member')
      .set('Authorization', 'Bearer non-member-token')
      .expect(403);
  });

  it('allows m2m token with correct scope', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/scope-access')
      .set('Authorization', 'Bearer m2m-good-token')
      .expect(200);
  });

  it('returns 403 for m2m token with wrong scope', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/scope-access')
      .set('Authorization', 'Bearer m2m-bad-token')
      .expect(403);
  });

  it('applies allowRule + denyRule combination', async () => {
    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/allow-deny')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    await request(app.getHttpServer())
      .get('/v6/projects/permission-system/allow-deny')
      .set('Authorization', 'Bearer user-token')
      .expect(403);
  });

  it('loads project members through project context interceptor', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/permission-system/777/context')
      .set('Authorization', 'Bearer member-token')
      .expect(200);

    expect(response.body.memberCount).toBe(2);
    expect(response.body.roles).toEqual(
      expect.arrayContaining([
        ProjectMemberRole.MANAGER,
        ProjectMemberRole.COPILOT,
      ]),
    );
  });
});
