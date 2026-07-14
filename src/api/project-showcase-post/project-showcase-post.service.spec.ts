import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ProjectShowcasePostService } from './project-showcase-post.service';

jest.mock('src/shared/utils/cloudfront.utils', () => ({
  signCloudFrontUrl: jest.fn((url: string) => `${url}?signed=1`),
}));

const challengeClientMock = {
  challenge: {
    findMany: jest.fn(),
  },
};

const membersClientMock = {
  member: {
    findMany: jest.fn(),
  },
};

const resourcesClientMock = {
  resource: {
    findMany: jest.fn(),
  },
};

const skillsClientMock = {
  skill: {
    findMany: jest.fn(),
  },
};

jest.mock('src/shared/global/external-prisma.client', () => ({
  getChallengesPrismaClient: () => challengeClientMock,
  getMembersPrismaClient: () => membersClientMock,
  getResourcesPrismaClient: () => resourcesClientMock,
  getSkillsPrismaClient: () => skillsClientMock,
  getSubmitterRoleId: () => '732339e7-8e30-49d7-9198-cccf9451e221',
}));98

const { ProjectShowcasePostService: ProjectShowcasePostServiceClass } =
  require('./project-showcase-post.service');

describe('ProjectShowcasePostService', () => {
  const prismaMock = {
    projectShowcasePost: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  let service: InstanceType<typeof ProjectShowcasePostServiceClass>;
  const user = {
    userId: '42',
    isMachine: false,
    tokenPayload: {},
  } as any;

  function buildPostRecord(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: BigInt(10),
      title: 'Showcase post',
      content: 'Content',
      status: 'DRAFT',
      projectId: BigInt(1001),
      challengeIds: ['100'],
      createdById: 42,
      updatedById: 42,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      industries: [
        {
          industry: {
            id: BigInt(5),
            name: 'Finance',
          },
        },
      ],
      categories: [
        {
          category: {
            id: BigInt(7),
            name: 'Web',
          },
        },
      ],
      project: {
        id: BigInt(1001),
        name: 'Project Title',
      },
      media: [
        {
          id: BigInt(101),
          type: 'image/png',
          url: 'https://example.com/image.png',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          createdBy: BigInt(42),
        },
      ],
      ...overrides,
    } as const;
  }

  beforeEach(() => {
    jest.clearAllMocks();

    permissionServiceMock.hasNamedPermission.mockReturnValue(true);
    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [
        {
          userId: BigInt(42),
          role: 'manager',
          deletedAt: null,
        },
      ],
    });

    challengeClientMock.challenge.findMany.mockResolvedValue([
      {
        id: '100',
        numOfSubmissions: 5,
        numOfRegistrants: 3,
        track: { name: 'Development' },
        skills: [{ skillId: 'skill-1' }, { skillId: 'skill-2' }],
      },
    ]);

    resourcesClientMock.resource.findMany.mockResolvedValue([
      { challengeId: '100', memberId: '42' },
      { challengeId: '100', memberId: '43' },
    ]);

    membersClientMock.member.findMany.mockResolvedValue([
      {
        userId: BigInt(42),
        country: 'US',
        homeCountryCode: 'US',
        competitionCountryCode: 'US',
      },
      {
        userId: BigInt(43),
        country: 'CA',
        homeCountryCode: 'CA',
        competitionCountryCode: 'CA',
      },
    ]);

    skillsClientMock.skill.findMany.mockResolvedValue([
      { id: 'skill-1', name: 'Skill One' },
      { id: 'skill-2', name: 'Skill Two' },
    ]);

    service = new ProjectShowcasePostServiceClass(
      prismaMock as any,
      permissionServiceMock as any,
    );
  });

  it('lists all showcase posts with default sorting', async () => {
    prismaMock.projectShowcasePost.findMany.mockResolvedValue([
      buildPostRecord(),
    ]);

    const response = await service.listPosts({});

    expect(prismaMock.projectShowcasePost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }],
      }),
    );
    expect(response).toEqual([
      expect.objectContaining({
        id: '10',
        projectId: '1001',
        industries: [{ id: '5', name: 'Finance' }],
        categories: [{ id: '7', name: 'Web' }],
      }),
    ]);
  });

  it('filters posts by keyword matching project name or description', async () => {
    prismaMock.projectShowcasePost.findMany.mockResolvedValue([
      buildPostRecord(),
    ]);

    await service.listPosts({ keyword: 'Project' });

    expect(prismaMock.projectShowcasePost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              project: {
                is: {
                  name: {
                    contains: 'Project',
                    mode: 'insensitive',
                  },
                },
              },
            }),
            expect.objectContaining({
              project: {
                is: {
                  description: {
                    contains: 'Project',
                    mode: 'insensitive',
                  },
                },
              },
            }),
          ]),
        }),
      }),
    );
  });

  it('lists posts for a project with permission checks', async () => {
    prismaMock.projectShowcasePost.findMany.mockResolvedValue([
      buildPostRecord({ status: 'PUBLISHED' }),
    ]);

    const response = await service.listProjectPosts(
      '1001',
      { status: 'published' },
      user,
    );

    expect(prismaMock.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1001), deletedAt: null },
      }),
    );
    expect(prismaMock.projectShowcasePost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: BigInt(1001),
          status: 'PUBLISHED',
        }),
      }),
    );
    expect(response[0].id).toBe('10');
  });

  it('gets a post by id and project', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord({ status: 'PUBLISHED' }),
    );

    const response = await service.getPost('1001', '10', user);

    expect(response).toEqual(
      expect.objectContaining({
        id: '10',
        status: 'PUBLISHED',
      }),
    );
    expect(prismaMock.projectShowcasePost.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(10), projectId: BigInt(1001) },
      }),
    );
  });

  it('throws NotFoundException when getting missing post', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(undefined);

    await expect(service.getPost('1001', '999', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates a new project showcase post with default draft status', async () => {
    prismaMock.projectShowcasePost.create.mockResolvedValue(
      buildPostRecord({ status: 'DRAFT' }),
    );

    const response = await service.createPost(
      '1001',
      {
        title: 'New post',
        content: 'New content',
        industryIds: ['5'],
        categoryIds: ['7'],
      },
      user,
    );

    expect(prismaMock.projectShowcasePost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'New post',
          content: 'New content',
          status: 'DRAFT',
          projectId: BigInt(1001),
          createdById: 42,
          updatedById: 42,
          industries: {
            create: [{ industryId: BigInt(5) }],
          },
          categories: {
            create: [{ categoryId: BigInt(7) }],
          },
          media: {
            create: [],
          },
        }),
      }),
    );
    expect(response.status).toBe('DRAFT');
    expect(challengeClientMock.challenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['100'] } },
      }),
    );
    expect(resourcesClientMock.resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          challengeId: { in: ['100'] },
          roleId: '732339e7-8e30-49d7-9198-cccf9451e221',
        },
      }),
    );
  });

  it('creates a new project showcase post with media assets', async () => {
    prismaMock.projectShowcasePost.create.mockResolvedValue(
      buildPostRecord({
        status: 'DRAFT',
        media: [
          {
            id: BigInt(101),
            type: 'image/png',
            url: 'https://example.com/image.png',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            createdBy: BigInt(42),
          },
        ],
      }),
    );

    const response = await service.createPost(
      '1001',
      {
        title: 'New post',
        content: 'New content',
        industryIds: ['5'],
        categoryIds: ['7'],
        media: [
          {
            type: 'image/png',
            url: 'https://example.com/image.png',
          },
        ],
      },
      user,
    );

    expect(prismaMock.projectShowcasePost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          media: {
            create: [
              {
                type: 'image/png',
                url: 'https://example.com/image.png',
                createdBy: BigInt(42),
              },
            ],
          },
        }),
      }),
    );
    expect(response.media).toEqual([
      expect.objectContaining({
        id: '101',
        type: 'image/png',
        url: 'https://example.com/image.png?signed=1',
      }),
    ]);
  });

  it('throws NotFoundException when create hits an industry foreign key constraint', async () => {
    const error = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype,
    );
    Object.assign(error, {
      message:
        'Foreign key constraint violated on the constraint: `project_showcase_post_industries_industry_fkey`',
      code: 'P2003',
      meta: { constraint: 'project_showcase_post_industries_industry_fkey' },
    });

    prismaMock.projectShowcasePost.create.mockRejectedValue(error);

    await expect(
      service.createPost(
        '1001',
        {
          title: 'New post',
          content: 'New content',
          industryIds: ['5'],
          categoryIds: ['7'],
        },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when create hits a category foreign key constraint', async () => {
    const error = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype,
    );
    Object.assign(error, {
      message:
        'Foreign key constraint violated on the constraint: `project_showcase_post_categories_category_fkey`',
      code: 'P2003',
      meta: { constraint: 'project_showcase_post_categories_category_fkey' },
    });

    prismaMock.projectShowcasePost.create.mockRejectedValue(error);

    await expect(
      service.createPost(
        '1001',
        {
          title: 'New post',
          content: 'New content',
          industryIds: ['5'],
          categoryIds: ['7'],
        },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
  });


  it('throws NotFoundException when updating a missing post', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(undefined);

    await expect(
      service.updatePost(
        '1001',
        '10',
        { title: 'Updated title' },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates a post with provided fields and taxonomy ids', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord(),
    );
    prismaMock.projectShowcasePost.update.mockResolvedValue(
      buildPostRecord({ title: 'Updated title' }),
    );

    const response = await service.updatePost(
      '1001',
      '10',
      {
        title: 'Updated title',
        industryIds: ['11'],
        categoryIds: ['12'],
      },
      user,
    );

    expect(prismaMock.projectShowcasePost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(10) },
        data: expect.objectContaining({
          title: 'Updated title',
          industries: {
            deleteMany: {},
            create: [{ industryId: BigInt(11) }],
          },
          categories: {
            deleteMany: {},
            create: [{ categoryId: BigInt(12) }],
          },
        }),
      }),
    );
    expect(response.title).toBe('Updated title');
  });

  it('updates a post with media assets', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord(),
    );
    prismaMock.projectShowcasePost.update.mockResolvedValue(
      buildPostRecord({
        title: 'Updated title',
        media: [
          {
            id: BigInt(102),
            type: 'video/mp4',
            url: 'https://example.com/video.mp4',
            createdAt: new Date('2026-01-01T00:00:00Z'),
            createdBy: BigInt(42),
          },
        ],
      }),
    );

    const response = await service.updatePost(
      '1001',
      '10',
      {
        title: 'Updated title',
        media: [
          {
            type: 'video/mp4',
            url: 'https://example.com/video.mp4',
          },
        ],
      },
      user,
    );

    expect(prismaMock.projectShowcasePost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(10) },
        data: expect.objectContaining({
          media: {
            deleteMany: {},
            create: [
              {
                type: 'video/mp4',
                url: 'https://example.com/video.mp4',
                createdBy: BigInt(42),
              },
            ],
          },
        }),
      }),
    );
    expect(response.media).toEqual([
      expect.objectContaining({
        id: '102',
        type: 'video/mp4',
        url: 'https://example.com/video.mp4?signed=1',
      }),
    ]);
  });

  it('sets publishedAt and publishedBy when publishing a draft post', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord({
        status: 'DRAFT',
        publishedAt: null,
        publishedBy: null,
      }),
    );
    prismaMock.projectShowcasePost.update.mockResolvedValue(
      buildPostRecord({
        status: 'PUBLISHED',
        publishedAt: new Date('2026-07-13T12:00:00Z'),
        publishedBy: 42,
      }),
    );

    const response = await service.updatePost(
      '1001',
      '10',
      { status: 'PUBLISHED' },
      user,
    );

    expect(prismaMock.projectShowcasePost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(10) },
        data: expect.objectContaining({
          status: 'PUBLISHED',
          publishedAt: expect.any(Date),
          publishedBy: 42,
        }),
      }),
    );
    expect(response.status).toBe('PUBLISHED');
    expect(response.publishedAt).toBeDefined();
    expect(response.publishedBy).toBe(42);
  });

  it('does not override publishedAt/publishedBy when updating an already published post', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord({
        status: 'PUBLISHED',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        publishedBy: 42,
      }),
    );
    prismaMock.projectShowcasePost.update.mockResolvedValue(
      buildPostRecord({
        title: 'Updated title',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        publishedBy: 42,
      }),
    );

    const response = await service.updatePost(
      '1001',
      '10',
      {
        title: 'Updated title',
        status: 'PUBLISHED',
      },
      user,
    );

    expect(prismaMock.projectShowcasePost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(10) },
        data: expect.objectContaining({
          title: 'Updated title',
          status: 'PUBLISHED',
        }),
      }),
    );
    expect(response.publishedAt).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(response.publishedBy).toBe(42);
  });

  it('throws NotFoundException when update hits an industry foreign key constraint', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord(),
    );
    const error = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype,
    );
    Object.assign(error, {
      message:
        'Foreign key constraint violated on the constraint: `project_showcase_post_industries_industry_fkey`',
      code: 'P2003',
      meta: { constraint: 'project_showcase_post_industries_industry_fkey' },
    });

    prismaMock.projectShowcasePost.update.mockRejectedValue(error);

    await expect(
      service.updatePost(
        '1001',
        '10',
        {
          industryIds: ['11'],
        },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when update hits a category foreign key constraint', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord(),
    );
    const error = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype,
    );
    Object.assign(error, {
      message:
        'Foreign key constraint violated on the constraint: `project_showcase_post_categories_category_fkey`',
      code: 'P2003',
      meta: { constraint: 'project_showcase_post_categories_category_fkey' },
    });

    prismaMock.projectShowcasePost.update.mockRejectedValue(error);

    await expect(
      service.updatePost(
        '1001',
        '10',
        {
          categoryIds: ['12'],
        },
        user,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when deleting a missing post', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(undefined);

    await expect(service.deletePost('1001', '10', user)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes an existing post', async () => {
    prismaMock.projectShowcasePost.findFirst.mockResolvedValue(
      buildPostRecord(),
    );
    prismaMock.projectShowcasePost.delete.mockResolvedValue(undefined);

    await service.deletePost('1001', '10', user);

    expect(prismaMock.projectShowcasePost.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(10) } }),
    );
  });
});
