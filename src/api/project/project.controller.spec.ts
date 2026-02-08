import { Request, Response } from 'express';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

describe('ProjectController', () => {
  const serviceMock = {
    listProjects: jest.fn(),
    getProject: jest.fn(),
    createProject: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  };

  let controller: ProjectController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectController(
      serviceMock as unknown as ProjectService,
    );
  });

  it('lists projects and sets pagination headers', async () => {
    serviceMock.listProjects.mockResolvedValue({
      data: [{ id: '1', name: 'Project 1' }],
      page: 2,
      perPage: 10,
      total: 25,
    });

    const req = {
      protocol: 'https',
      get: jest.fn().mockReturnValue('example.com'),
      baseUrl: '/v6/projects',
      path: '',
      query: {},
    } as unknown as Request;

    const headerStore: Record<string, string> = {};

    const res = {
      header: jest.fn((name: string, value: string) => {
        headerStore[name] = value;
      }),
      getHeader: jest.fn((name: string) => headerStore[name]),
    } as unknown as Response;

    const data = await controller.listProjects(
      req,
      res,
      {
        page: 2,
        perPage: 10,
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(data).toHaveLength(1);
    expect(headerStore['X-Page']).toBe('2');
    expect(headerStore['X-Per-Page']).toBe('10');
    expect(headerStore['X-Total']).toBe('25');
    expect(headerStore['X-Total-Pages']).toBe('3');
  });

  it('gets project by id', async () => {
    serviceMock.getProject.mockResolvedValue({ id: '101' });

    const result = await controller.getProject(
      '101',
      {
        fields: 'members,invites',
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(result).toEqual({ id: '101' });
    expect(serviceMock.getProject).toHaveBeenCalledWith(
      '101',
      'members,invites',
      expect.objectContaining({ userId: '123' }),
    );
  });

  it('creates project', async () => {
    serviceMock.createProject.mockResolvedValue({ id: '202' });

    const result = await controller.createProject(
      {
        name: 'My Project',
        type: 'app',
      } as any,
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(result).toEqual({ id: '202' });
    expect(serviceMock.createProject).toHaveBeenCalled();
  });

  it('updates project', async () => {
    serviceMock.updateProject.mockResolvedValue({ id: '303', name: 'Updated' });

    const result = await controller.updateProject(
      '303',
      {
        name: 'Updated',
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(result).toEqual({ id: '303', name: 'Updated' });
    expect(serviceMock.updateProject).toHaveBeenCalledWith(
      '303',
      {
        name: 'Updated',
      },
      expect.objectContaining({ userId: '123' }),
    );
  });

  it('deletes project', async () => {
    serviceMock.deleteProject.mockResolvedValue(undefined);

    await controller.deleteProject('404', {
      userId: '123',
      isMachine: false,
    });

    expect(serviceMock.deleteProject).toHaveBeenCalledWith(
      '404',
      expect.objectContaining({ userId: '123' }),
    );
  });
});
