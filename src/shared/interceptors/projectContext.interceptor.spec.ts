import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ProjectContextInterceptor } from './projectContext.interceptor';

describe('ProjectContextInterceptor', () => {
  const prismaServiceMock = {
    projectMember: {
      findMany: jest.fn(),
    },
  };

  let interceptor: ProjectContextInterceptor;

  const next: CallHandler = {
    handle: () => of({ ok: true }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new ProjectContextInterceptor(prismaServiceMock as any);
  });

  const createExecutionContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  it('loads project members when projectId exists', async () => {
    const request: any = {
      params: {
        projectId: '1001',
      },
    };

    prismaServiceMock.projectMember.findMany.mockResolvedValue([
      {
        userId: BigInt(123),
        role: 'manager',
        isPrimary: true,
      },
    ]);

    await interceptor.intercept(createExecutionContext(request), next);

    expect(prismaServiceMock.projectMember.findMany).toHaveBeenCalledWith({
      where: {
        projectId: BigInt(1001),
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        isPrimary: true,
        deletedAt: true,
      },
    });

    expect(request.projectContext.projectMembers).toHaveLength(1);
    expect(request.projectContext.projectId).toBe('1001');
  });

  it('uses preloaded project members without querying again', async () => {
    const request: any = {
      params: {
        projectId: '1001',
      },
      projectContext: {
        projectId: '1001',
        projectMembers: [
          {
            userId: '123',
            role: 'manager',
          },
        ],
      },
    };

    await interceptor.intercept(createExecutionContext(request), next);

    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
    expect(request.projectContext.projectMembers).toHaveLength(1);
  });

  it('handles missing projectId gracefully', async () => {
    const request: any = {
      params: {},
    };

    await interceptor.intercept(createExecutionContext(request), next);

    expect(prismaServiceMock.projectMember.findMany).not.toHaveBeenCalled();
    expect(request.projectContext.projectMembers).toEqual([]);
  });

  it('handles database errors gracefully', async () => {
    const request: any = {
      params: {
        projectId: '1002',
      },
    };

    prismaServiceMock.projectMember.findMany.mockRejectedValue(
      new Error('DB error'),
    );

    await interceptor.intercept(createExecutionContext(request), next);

    expect(request.projectContext.projectMembers).toEqual([]);
    expect(request.projectContext.projectId).toBe('1002');
  });
});
