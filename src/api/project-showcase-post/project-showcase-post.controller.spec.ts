import { ProjectShowcasePostController } from './project-showcase-post.controller';

describe('ProjectShowcasePostController', () => {
  const serviceMock = {
    listPosts: jest.fn(),
    countPosts: jest.fn(),
    listProjectPosts: jest.fn(),
    countProjectPosts: jest.fn(),
    getPost: jest.fn(),
    createPost: jest.fn(),
    updatePost: jest.fn(),
    deletePost: jest.fn(),
  };

  let controller: ProjectShowcasePostController;
  const user = { userId: '42', isMachine: false, tokenPayload: {} } as any;
  const mockReq = {
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost'),
    baseUrl: '',
    path: '/projects/posts',
  } as any;
  const mockRes = {
    header: jest.fn(),
    getHeader: jest.fn().mockReturnValue(undefined),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectShowcasePostController(serviceMock as any);
  });

  it('searches posts', async () => {
    serviceMock.listPosts.mockResolvedValue([{ id: '1' }]);
    serviceMock.countPosts = jest.fn().mockResolvedValue(1);

    const response = await controller.searchPosts(mockReq, mockRes, {});

    expect(response).toEqual([{ id: '1' }]);
    expect(serviceMock.listPosts).toHaveBeenCalledWith({});
    expect(serviceMock.countPosts).toHaveBeenCalledWith({});
  });

  it('lists project-specific posts', async () => {
    serviceMock.listProjectPosts.mockResolvedValue([{ id: '2' }]);
    serviceMock.countProjectPosts = jest.fn().mockResolvedValue(1);

    const response = await controller.listProjectPosts(
      mockReq,
      mockRes,
      '1001',
      { status: 'DRAFT' },
      user,
    );

    expect(response).toEqual([{ id: '2' }]);
    expect(serviceMock.listProjectPosts).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({ status: 'DRAFT' }),
      user,
    );
    expect(serviceMock.countProjectPosts).toHaveBeenCalledWith(
      '1001',
      expect.objectContaining({ status: 'DRAFT' }),
      user,
    );
  });

  it('gets a project post', async () => {
    serviceMock.getPost.mockResolvedValue({ id: '3' });

    const response = await controller.getProjectPost('1001', '10', user);

    expect(response).toEqual({ id: '3' });
    expect(serviceMock.getPost).toHaveBeenCalledWith('1001', '10', user);
  });

  it('creates a project post', async () => {
    const dto = { title: 'New', content: 'Content' };
    serviceMock.createPost.mockResolvedValue({ id: '4' });

    const response = await controller.createProjectPost('1001', dto, user);

    expect(response).toEqual({ id: '4' });
    expect(serviceMock.createPost).toHaveBeenCalledWith('1001', dto, user);
  });

  it('updates a project post', async () => {
    const dto = { title: 'Updated' };
    serviceMock.updatePost.mockResolvedValue({ id: '5' });

    const response = await controller.updateProjectPost(
      '1001',
      '10',
      dto,
      user,
    );

    expect(response).toEqual({ id: '5' });
    expect(serviceMock.updatePost).toHaveBeenCalledWith(
      '1001',
      '10',
      dto,
      user,
    );
  });

  it('deletes a project post', async () => {
    serviceMock.deletePost.mockResolvedValue(undefined);

    await controller.deleteProjectPost('1001', '10', user);

    expect(serviceMock.deletePost).toHaveBeenCalledWith('1001', '10', user);
  });
});
