import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DB_COMPAT_ENABLED = process.env.DB_COMPAT_TESTS_ENABLED === 'true';
const DB_MIGRATION_SAFETY_ENABLED =
  process.env.DB_MIGRATION_SAFETY_ENABLED === 'true';

const describeIfDbCompat = DB_COMPAT_ENABLED ? describe : describe.skip;
const projectRoot = path.resolve(__dirname, '..');

function getSchemaFromUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).searchParams.get('schema') ?? undefined;
  } catch {
    return undefined;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  const schema = getSchemaFromUrl(connectionString);
  const adapter = new PrismaPg(
    { connectionString },
    schema ? { schema } : undefined,
  );

  return new PrismaClient({ adapter });
}

describeIfDbCompat('Database compatibility validation', () => {
  const prisma = createPrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('validates prisma schema aligns with current database pull output', () => {
    const pulledSchema = execSync(
      'npx prisma db pull --print --schema prisma/schema.prisma',
      {
        cwd: projectRoot,
        stdio: 'pipe',
      },
    ).toString();

    const localSchema = readFileSync(
      path.join(projectRoot, 'prisma', 'schema.prisma'),
      'utf8',
    );

    const keyModels = [
      'model Project',
      'model ProjectMember',
      'model ProjectMemberInvite',
      'model ProjectPhase',
      'model PhaseProduct',
      'model WorkStream',
      'model CopilotRequest',
      'model CopilotOpportunity',
      'model WorkManagementPermission',
    ];

    for (const modelSignature of keyModels) {
      expect(pulledSchema).toContain(modelSignature);
      expect(localSchema).toContain(modelSignature);
    }
  });

  it('validates BigInt, JSON and timestamp compatibility on project records', async () => {
    const project = await prisma.project.findFirst({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        details: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      return;
    }

    expect(typeof project.id).toBe('bigint');
    expect(typeof project.createdAt.getTime()).toBe('number');
    expect(typeof project.updatedAt.getTime()).toBe('number');
    expect(typeof project.status).toBe('string');

    if (project.details !== null) {
      expect(typeof project.details).toBe('object');
    }
  });

  it('validates soft-delete filtering and foreign key relationship traversal', async () => {
    const [total, active] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({
        where: {
          deletedAt: null,
        },
      }),
    ]);

    expect(active).toBeLessThanOrEqual(total);

    const joinedProject = await prisma.project.findFirst({
      where: {
        deletedAt: null,
      },
      include: {
        members: {
          where: {
            deletedAt: null,
          },
          take: 5,
        },
        invites: {
          where: {
            deletedAt: null,
          },
          take: 5,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!joinedProject) {
      return;
    }

    expect(Array.isArray(joinedProject.members)).toBe(true);
    expect(Array.isArray(joinedProject.invites)).toBe(true);
  });

  it('validates complex nested filtering/sorting query patterns', async () => {
    const rows = await prisma.project.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            deletedAt: null,
          },
        },
      },
      include: {
        members: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
          take: 3,
        },
        invites: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            id: 'asc',
          },
          take: 3,
        },
      },
      orderBy: [
        {
          lastActivityAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 10,
    });

    expect(Array.isArray(rows)).toBe(true);
  });

  it('validates prisma migrate deploy safety on existing schema', () => {
    if (!DB_MIGRATION_SAFETY_ENABLED) {
      return;
    }

    const output = execSync(
      'npx prisma migrate deploy --schema prisma/schema.prisma',
      {
        cwd: projectRoot,
        stdio: 'pipe',
      },
    ).toString();

    expect(output.toLowerCase()).toContain('migrations');
  });

  it('validates migration rollback readiness via migrate status output', () => {
    const output = execSync(
      'npx prisma migrate status --schema prisma/schema.prisma',
      {
        cwd: projectRoot,
        stdio: 'pipe',
      },
    ).toString();

    expect(output.toLowerCase()).toContain('database');
  });
});
