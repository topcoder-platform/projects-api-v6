import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { EventBusService } from '../src/shared/modules/global/eventBus.service';
import { JwtService } from '../src/shared/modules/global/jwt.service';
import { M2MService } from '../src/shared/modules/global/m2m.service';
import { PrismaService } from '../src/shared/modules/global/prisma.service';

type FormRecord = {
  id: bigint;
  key: string;
  version: bigint;
  revision: bigint;
  config: Record<string, unknown>;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedBy: number | null;
  createdBy: number;
  updatedBy: number;
};

type ProjectTemplateRecord = {
  id: bigint;
  name: string;
  key: string;
  category: string;
  subCategory: string | null;
  metadata: Record<string, unknown>;
  icon: string;
  question: string;
  info: string;
  aliases: unknown[];
  scope: Record<string, unknown> | null;
  phases: Record<string, unknown> | null;
  form: Record<string, unknown> | null;
  planConfig: Record<string, unknown> | null;
  priceConfig: Record<string, unknown> | null;
  disabled: boolean;
  hidden: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedBy: bigint | null;
  createdBy: bigint;
  updatedBy: bigint;
};

function sortByOrder(
  orderBy: Array<Record<string, 'asc' | 'desc'>>,
  a: any,
  b: any,
): number {
  for (const item of orderBy) {
    const [key, direction] = Object.entries(item)[0];
    const left = a[key];
    const right = b[key];

    if (left === right) {
      continue;
    }

    if (left > right) {
      return direction === 'asc' ? 1 : -1;
    }

    return direction === 'asc' ? -1 : 1;
  }

  return 0;
}

function matchesWhere(record: any, where: any): boolean {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      'not' in (value as Record<string, unknown>)
    ) {
      return record[key] !== (value as { not: unknown }).not;
    }

    return record[key] === value;
  });
}

describe('Metadata (e2e)', () => {
  let app: INestApplication;
  let eventBusMock: { publishProjectEvent: jest.Mock };

  const db: {
    forms: FormRecord[];
    projectTemplates: ProjectTemplateRecord[];
  } = {
    forms: [],
    projectTemplates: [],
  };

  let formId = BigInt(1);
  let projectTemplateId = BigInt(1);

  const prismaMock = {
    form: {
      findFirst: jest.fn((args: any = {}) => {
        const where = args.where || {};
        let records = db.forms.filter((record) => matchesWhere(record, where));

        if (Array.isArray(args.orderBy)) {
          records = [...records].sort((a, b) =>
            sortByOrder(args.orderBy, a, b),
          );
        }

        return records[0] || null;
      }),
      findMany: jest.fn((args: any = {}) => {
        const where = args.where || {};
        let records = db.forms.filter((record) => matchesWhere(record, where));

        if (Array.isArray(args.orderBy)) {
          records = [...records].sort((a, b) =>
            sortByOrder(args.orderBy, a, b),
          );
        }

        return records;
      }),
      create: jest.fn(({ data }: any) => {
        const now = new Date();
        const created: FormRecord = {
          id: formId,
          key: data.key,
          version: data.version,
          revision: data.revision,
          config: data.config,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedBy: null,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };
        formId += BigInt(1);
        db.forms.push(created);
        return created;
      }),
      update: jest.fn(({ where, data }: any) => {
        const record = db.forms.find((item) => item.id === where.id);
        if (!record) {
          return null;
        }

        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      }),
      updateMany: jest.fn(({ where, data }: any) => {
        const records = db.forms.filter((record) =>
          matchesWhere(record, where),
        );
        records.forEach((record) => {
          Object.assign(record, data, { updatedAt: new Date() });
        });
        return { count: records.length };
      }),
    },
    planConfig: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    priceConfig: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    projectTemplate: {
      findMany: jest.fn((args: any = {}) => {
        const where = args.where || {};
        return db.projectTemplates.filter((record) =>
          matchesWhere(record, where),
        );
      }),
      findFirst: jest.fn((args: any = {}) => {
        const where = args.where || {};
        return (
          db.projectTemplates.find((record) => matchesWhere(record, where)) ||
          null
        );
      }),
      create: jest.fn(({ data }: any) => {
        const now = new Date();
        const created: ProjectTemplateRecord = {
          id: projectTemplateId,
          name: data.name,
          key: data.key,
          category: data.category,
          subCategory: data.subCategory || null,
          metadata: data.metadata || {},
          icon: data.icon,
          question: data.question,
          info: data.info,
          aliases: data.aliases || [],
          scope: data.scope === null ? null : data.scope,
          phases: data.phases === null ? null : data.phases,
          form: data.form === null ? null : data.form,
          planConfig: data.planConfig === null ? null : data.planConfig,
          priceConfig: data.priceConfig === null ? null : data.priceConfig,
          disabled: data.disabled || false,
          hidden: data.hidden || false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedBy: null,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        };

        projectTemplateId += BigInt(1);
        db.projectTemplates.push(created);
        return created;
      }),
      update: jest.fn(({ where, data }: any) => {
        const record = db.projectTemplates.find((item) => item.id === where.id);
        if (!record) {
          return null;
        }

        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      }),
    },
    productTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    projectType: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    productCategory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    milestoneTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    orgConfig: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    workManagementPermission: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const jwtServiceMock = {
    validateToken: jest.fn((token: string) => {
      if (token === 'admin-token') {
        return {
          userId: '123',
          roles: ['administrator'],
          isMachine: false,
        };
      }

      if (token === 'user-token') {
        return {
          userId: '456',
          roles: ['Topcoder User'],
          isMachine: false,
        };
      }

      throw new UnauthorizedException('Invalid token');
    }),
  };

  const m2mServiceMock = {
    validateMachineToken: jest.fn(() => ({ isMachine: false, scopes: [] })),
    hasRequiredScopes: jest.fn(() => false),
  };

  beforeAll(async () => {
    eventBusMock = {
      publishProjectEvent: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JwtService)
      .useValue(jwtServiceMock)
      .overrideProvider(M2MService)
      .useValue(m2mServiceMock)
      .overrideProvider(EventBusService)
      .useValue(eventBusMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v6');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.forms = [
      {
        id: BigInt(1),
        key: 'form_key',
        version: BigInt(1),
        revision: BigInt(1),
        config: { v: 1 },
        deletedAt: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        deletedBy: null,
        createdBy: 123,
        updatedBy: 123,
      },
      {
        id: BigInt(2),
        key: 'form_key',
        version: BigInt(2),
        revision: BigInt(1),
        config: { v: 2 },
        deletedAt: null,
        createdAt: new Date('2025-01-02T00:00:00.000Z'),
        updatedAt: new Date('2025-01-02T00:00:00.000Z'),
        deletedBy: null,
        createdBy: 123,
        updatedBy: 123,
      },
    ];

    db.projectTemplates = [
      {
        id: BigInt(1),
        name: 'Existing Template',
        key: 'design',
        category: 'development',
        subCategory: 'web',
        metadata: {},
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['alias'],
        scope: null,
        phases: null,
        form: { key: 'form_key', version: 1 },
        planConfig: null,
        priceConfig: null,
        disabled: false,
        hidden: false,
        deletedAt: null,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        deletedBy: null,
        createdBy: BigInt(123),
        updatedBy: BigInt(123),
      },
    ];

    formId = BigInt(3);
    projectTemplateId = BigInt(2);
    eventBusMock.publishProjectEvent.mockClear();
  });

  it('creates project template with valid form reference', async () => {
    const response = await request(app.getHttpServer())
      .post('/v6/projects/metadata/projectTemplates')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Template A',
        key: 'template_a',
        category: 'development',
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['a'],
        form: {
          key: 'form_key',
          version: 1,
        },
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        key: 'template_a',
        form: expect.objectContaining({
          key: 'form_key',
          version: '1',
        }),
      }),
    );
  });

  it('rejects project template creation with invalid form reference', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/metadata/projectTemplates')
      .set('Authorization', 'Bearer admin-token')
      .send({
        name: 'Template B',
        key: 'template_b',
        category: 'development',
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['b'],
        form: {
          key: 'missing_form',
          version: 1,
        },
      })
      .expect(400);
  });

  it('lists metadata with includeAllReferred=true', async () => {
    const response = await request(app.getHttpServer())
      .get('/v6/projects/metadata?includeAllReferred=true')
      .expect(200);

    expect(response.body.forms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: '1' }),
        expect.objectContaining({ version: '2' }),
      ]),
    );
  });

  it('creates a new form version with auto-incremented version', async () => {
    const response = await request(app.getHttpServer())
      .post('/v6/projects/metadata/form/form_key/versions')
      .set('Authorization', 'Bearer admin-token')
      .send({ config: { v: 3 } })
      .expect(201);

    expect(response.body.version).toBe('3');
  });

  it('creates a form revision with auto-incremented revision', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/metadata/form/form_key/versions')
      .set('Authorization', 'Bearer admin-token')
      .send({ config: { v: 3 } })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/v6/projects/metadata/form/form_key/versions/3/revisions')
      .set('Authorization', 'Bearer admin-token')
      .send({ config: { v: 3, rev: 2 } })
      .expect(201);

    expect(response.body.revision).toBe('2');
  });

  it('updates template and publishes metadata event', async () => {
    await request(app.getHttpServer())
      .patch('/v6/projects/metadata/projectTemplates/1')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Updated Template Name' })
      .expect(200);

    expect(eventBusMock.publishProjectEvent).toHaveBeenCalled();
  });

  it('deletes template using soft delete semantics', async () => {
    await request(app.getHttpServer())
      .delete('/v6/projects/metadata/projectTemplates/1')
      .set('Authorization', 'Bearer admin-token')
      .expect(204);

    const list = await request(app.getHttpServer())
      .get('/v6/projects/metadata/projectTemplates')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(list.body).toHaveLength(0);
  });

  it('rejects admin-only endpoint for non-admin user', async () => {
    await request(app.getHttpServer())
      .post('/v6/projects/metadata/projectTemplates')
      .set('Authorization', 'Bearer user-token')
      .send({
        name: 'Template C',
        key: 'template_c',
        category: 'development',
        icon: 'icon',
        question: 'question',
        info: 'info',
        aliases: ['c'],
      })
      .expect(403);
  });
});
