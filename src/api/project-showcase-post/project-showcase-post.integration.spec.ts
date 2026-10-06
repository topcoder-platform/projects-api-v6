import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ProjectShowcasePostService } from './project-showcase-post.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { JwtUser } from 'src/shared/modules/global/jwt.service';

const databaseTests = process.env.PROJECTS_TEST_DATABASE_URL
  ? describe
  : describe.skip;

// Requires a disposable PostgreSQL database with this repository's migrations applied.
databaseTests('showcase persistence with PostgreSQL', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: process.env.PROJECTS_TEST_DATABASE_URL },
      { schema: 'projects' },
    ),
  });
  const service = new ProjectShowcasePostService(
    prisma as PrismaService,
    { hasNamedPermission: () => true } as unknown as PermissionService,
  );
  const user = { userId: '42', isMachine: false, tokenPayload: {} } as JwtUser;
  let projectId: bigint;
  const details = {
    customer: 'Customer',
    smu: 'Europe',
    dealCloseDate: '2026-09-16',
    unrelated: { retained: true },
  };

  beforeEach(async () => {
    const project = await prisma.project.create({
      data: {
        name: 'PM-6329 integration fixture',
        type: 'app',
        status: 'active',
        details,
        lastActivityAt: new Date(),
        lastActivityUserId: '42',
        createdBy: 42,
        updatedBy: 42,
      },
    });
    projectId = project.id;
  });

  afterEach(async () => {
    await prisma.project.delete({ where: { id: projectId } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('round-trips showcase content and synchronizes project edits in both directions', async () => {
    const post = await service.createPost(
      String(projectId),
      {
        title: 'Showcase',
        content: 'Solution',
        type: 'Open Innovation',
        customer: 'Updated customer',
        smu: 'Others',
        smuOther: 'Custom',
        dealCloseDate: '2026-09-17',
        challenge: 'Challenge',
        businessImpact: 'Impact',
        keyWin: 'Win',
        currentStatus: 'Delivered',
        owner: 'Owner',
        sendToWin: true,
      },
      user,
    );
    expect(post).toMatchObject({
      customer: 'Updated customer',
      smu: 'Others',
      smuOther: 'Custom',
      sendToWin: true,
    });
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: projectId } }))
        .details,
    ).toEqual({
      ...details,
      customer: 'Updated customer',
      smu: 'Others',
      smuOther: 'Custom',
      dealCloseDate: '2026-09-17',
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { details: { ...details, customer: 'Edited in project' } },
    });
    expect(
      await service.getPost(String(projectId), post.id, user),
    ).toMatchObject({
      customer: 'Edited in project',
      smu: 'Europe',
      challenge: 'Challenge',
      content: 'Solution',
      businessImpact: 'Impact',
    });
    await service.updatePost(
      String(projectId),
      post.id,
      { sendToWin: false },
      user,
    );
    expect(
      await service.getPost(String(projectId), post.id, user),
    ).toMatchObject({ sendToWin: false, owner: 'Owner' });
  });

  it('rolls back project metadata when a showcase relation fails validation in the database', async () => {
    await expect(
      service.createPost(
        String(projectId),
        {
          title: 'Invalid relation',
          content: 'Solution',
          type: 'Open Innovation',
          customer: 'Must not persist',
          industryIds: ['999999999999999'],
        },
        user,
      ),
    ).rejects.toThrow();
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: projectId } }))
        .details,
    ).toEqual(details);
    expect(
      await prisma.projectShowcasePost.count({ where: { projectId } }),
    ).toBe(0);
  });

  it('preserves new fields on media-only patches and supports old posts without a type', async () => {
    const legacy = await prisma.projectShowcasePost.create({
      data: {
        projectId,
        title: 'Legacy',
        content: 'Solution',
        createdById: 42,
        updatedById: 42,
      },
    });
    await service.updatePost(
      String(projectId),
      String(legacy.id),
      { media: [] },
      user,
    );
    await expect(
      service.updatePost(
        String(projectId),
        String(legacy.id),
        { sendToWin: true },
        user,
      ),
    ).rejects.toThrow('type');
    const saved = await service.updatePost(
      String(projectId),
      String(legacy.id),
      { type: 'AI Data Licensing', sendToWin: true },
      user,
    );
    expect(saved).toMatchObject({
      type: 'AI Data Licensing',
      sendToWin: true,
      customer: 'Customer',
    });
  });
});
