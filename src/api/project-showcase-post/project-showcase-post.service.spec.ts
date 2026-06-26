import { NotFoundException } from '@nestjs/common';
import { ProjectShowcasePostService } from './project-showcase-post.service';

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

  let service: ProjectShowcasePostService;
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
      ...overrides,
    } as const;
  }

  beforeEach(() => {
    jest.resetAllMocks();

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

    service = new ProjectShowcasePostService(
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
        }),
      }),
    );
    expect(response.status).toBe('DRAFT');
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
