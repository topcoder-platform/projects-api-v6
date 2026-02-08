import {
  Controller,
  Get,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PhaseProductService } from '../src/api/phase-product/phase-product.service';
import { ProjectAttachmentService } from '../src/api/project-attachment/project-attachment.service';
import { ProjectPhaseService } from '../src/api/project-phase/project-phase.service';
import { ProjectMemberRole } from '../src/shared/enums/projectMemberRole.enum';
import { Scope } from '../src/shared/enums/scopes.enum';
import { UserRole } from '../src/shared/enums/userRole.enum';
import { JwtService, JwtUser } from '../src/shared/modules/global/jwt.service';
import { M2MService } from '../src/shared/modules/global/m2m.service';
import { PrismaService } from '../src/shared/modules/global/prisma.service';

const tokenUsers: Record<string, JwtUser> = {
  'manager-token': {
    userId: '100',
    roles: [UserRole.TOPCODER_USER],
    isMachine: false,
  },
};

@Controller('/projects/v5-compatibility')
class CompatibilityTestController {
  @Get('/health')
  health() {
    return { ok: true };
  }
}

describe('v5 compatibility for new v6 attachment/phase/product endpoints', () => {
  let app: INestApplication;

  const projectAttachmentServiceMock = {
    listAttachments: jest.fn(),
    getAttachment: jest.fn(),
    createAttachment: jest.fn(),
    updateAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
  };

  const projectPhaseServiceMock = {
    listPhases: jest.fn(),
    getPhase: jest.fn(),
    createPhase: jest.fn(),
    updatePhase: jest.fn(),
    deletePhase: jest.fn(),
  };

  const phaseProductServiceMock = {
    listPhaseProducts: jest.fn(),
    getPhaseProduct: jest.fn(),
    createPhaseProduct: jest.fn(),
    updatePhaseProduct: jest.fn(),
    deletePhaseProduct: jest.fn(),
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
      controllers: [CompatibilityTestController],
    })
      .overrideProvider(ProjectAttachmentService)
      .useValue(projectAttachmentServiceMock)
      .overrideProvider(ProjectPhaseService)
      .useValue(projectPhaseServiceMock)
      .overrideProvider(PhaseProductService)
      .useValue(phaseProductServiceMock)
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

    projectAttachmentServiceMock.listAttachments.mockResolvedValue([]);
    projectAttachmentServiceMock.getAttachment.mockResolvedValue({
      id: '1',
      projectId: '1001',
      title: 'spec-file',
      type: 'file',
      path: 'projects/1001/projects/spec-file.zip',
      tags: ['spec'],
      allowedUsers: [],
      url: 'https://download.example.com/spec-file.zip',
    });
    projectAttachmentServiceMock.createAttachment.mockResolvedValue({
      id: '2',
      projectId: '1001',
      title: 'created-file',
      type: 'file',
      path: 'projects/1001/projects/created-file.zip',
      tags: [],
      allowedUsers: [],
      downloadUrl: 'https://download.example.com/created-file.zip',
    });
    projectAttachmentServiceMock.updateAttachment.mockResolvedValue({
      id: '2',
    });
    projectAttachmentServiceMock.deleteAttachment.mockResolvedValue(undefined);

    projectPhaseServiceMock.listPhases.mockResolvedValue([
      {
        id: '10',
        name: 'Planning',
        status: 'active',
        products: [
          {
            id: '90',
            phaseId: '10',
            projectId: '1001',
            templateId: '67',
            name: 'Generic Product',
            type: 'generic-product',
            estimatedPrice: 1,
            actualPrice: 1,
            details: { challengeGuid: 'abc' },
          },
        ],
      },
    ]);
    projectPhaseServiceMock.getPhase.mockResolvedValue({ id: '10' });
    projectPhaseServiceMock.createPhase.mockResolvedValue({ id: '10' });
    projectPhaseServiceMock.updatePhase.mockResolvedValue({ id: '10' });
    projectPhaseServiceMock.deletePhase.mockResolvedValue(undefined);

    phaseProductServiceMock.listPhaseProducts.mockResolvedValue([]);
    phaseProductServiceMock.getPhaseProduct.mockResolvedValue({ id: '90' });
    phaseProductServiceMock.createPhaseProduct.mockResolvedValue({
      id: '90',
      phaseId: '10',
      projectId: '1001',
      templateId: '67',
      name: 'Generic Product',
      type: 'generic-product',
      estimatedPrice: 1,
      actualPrice: 1,
      details: { challengeGuid: 'abc' },
    });
    phaseProductServiceMock.updatePhaseProduct.mockResolvedValue({ id: '90' });
    phaseProductServiceMock.deletePhaseProduct.mockResolvedValue(undefined);
  });

  it('keeps v5-compatible single attachment response contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/1001/attachments/1')
      .set('Authorization', 'Bearer manager-token')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '1',
        projectId: '1001',
        type: 'file',
        path: expect.any(String),
        url: expect.any(String),
      }),
    );
  });

  it('keeps v5-compatible file attachment create response contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/v6/projects/1001/attachments')
      .set('Authorization', 'Bearer manager-token')
      .send({
        title: 'created-file',
        path: 'tmp/created-file.zip',
        type: 'file',
        contentType: 'application/zip',
        s3Bucket: 'incoming-bucket',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: '2',
        type: 'file',
        downloadUrl: expect.any(String),
      }),
    );
  });

  it('keeps v5-compatible phase list response contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/1001/phases')
      .set('Authorization', 'Bearer manager-token')
      .query({ fields: 'id,name,products' })
      .expect(200);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        id: '10',
        name: 'Planning',
        products: expect.any(Array),
      }),
    );
  });

  it('keeps v5-compatible attachment patch contract when only allowedUsers are provided', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/1001/attachments/2')
      .set('Authorization', 'Bearer manager-token')
      .send({
        allowedUsers: [100, 200],
      })
      .expect(200);

    expect(projectAttachmentServiceMock.updateAttachment).toHaveBeenCalledWith(
      '1001',
      '2',
      expect.objectContaining({
        allowedUsers: [100, 200],
      }),
      expect.objectContaining({
        userId: '100',
      }),
    );
  });

  it('keeps v5-compatible attachment patch contract when only tags are provided', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/1001/attachments/2')
      .set('Authorization', 'Bearer manager-token')
      .send({
        tags: ['release', 'docs'],
      })
      .expect(200);

    expect(projectAttachmentServiceMock.updateAttachment).toHaveBeenCalledWith(
      '1001',
      '2',
      expect.objectContaining({
        tags: ['release', 'docs'],
      }),
      expect.objectContaining({
        userId: '100',
      }),
    );
  });

  it('keeps v5-compatible phase product create and delete contracts', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/v6/projects/1001/phases/10/products')
      .set('Authorization', 'Bearer manager-token')
      .send({
        name: 'Generic Product',
        type: 'generic-product',
        templateId: 67,
        estimatedPrice: 1,
        actualPrice: 1,
        details: {
          challengeGuid: 'abc',
        },
      })
      .expect(201);

    expect(createResponse.body).toEqual(
      expect.objectContaining({
        id: '90',
        phaseId: '10',
        projectId: '1001',
        name: 'Generic Product',
        type: 'generic-product',
      }),
    );

    await request(app.getHttpServer())
      .delete('/v6/projects/1001/phases/10/products/90')
      .set('Authorization', 'Bearer manager-token')
      .expect(204);
  });

  it('rejects m2m calls without permission mapping parity', async () => {
    (jwtServiceMock.validateToken as jest.Mock).mockResolvedValueOnce({
      scopes: [Scope.PROJECTS_READ],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
        scope: Scope.PROJECTS_READ,
      },
    });

    await request(app.getHttpServer())
      .get('/v6/projects/1001/attachments/1')
      .set('Authorization', 'Bearer m2m-project-read')
      .expect(403);
  });
});
