import { BadRequestException } from '@nestjs/common';
import { TimelineReference } from '@prisma/client';
import { ExecutionContext } from '@nestjs/common';
import { TimelineProjectContextGuard } from './timeline-project-context.guard';

function createExecutionContext(
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('TimelineProjectContextGuard', () => {
  const timelineReferenceServiceMock = {
    parsePositiveBigInt: jest.fn(),
    resolveProjectContextByTimelineId: jest.fn(),
    parseTimelineReference: jest.fn(),
    resolveProjectContextByReference: jest.fn(),
  };

  let guard: TimelineProjectContextGuard;

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new TimelineProjectContextGuard(
      timelineReferenceServiceMock as any,
    );
  });

  it('attaches project context from timeline id param', async () => {
    timelineReferenceServiceMock.parsePositiveBigInt.mockReturnValue(BigInt(7));
    timelineReferenceServiceMock.resolveProjectContextByTimelineId.mockResolvedValue(
      {
        timeline: {
          id: BigInt(7),
          reference: TimelineReference.project,
          referenceId: BigInt(1001),
        },
        reference: TimelineReference.project,
        referenceId: BigInt(1001),
        projectId: BigInt(1001),
      },
    );

    const request: any = {
      params: {
        timelineId: '7',
      },
      body: {},
    };

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.params.projectId).toBe('1001');
  });

  it('attaches project context from query reference/referenceId', async () => {
    timelineReferenceServiceMock.parseTimelineReference.mockReturnValue(
      TimelineReference.phase,
    );
    timelineReferenceServiceMock.parsePositiveBigInt.mockReturnValue(
      BigInt(2001),
    );
    timelineReferenceServiceMock.resolveProjectContextByReference.mockResolvedValue(
      {
        reference: TimelineReference.phase,
        referenceId: BigInt(2001),
        projectId: BigInt(1002),
      },
    );

    const request: any = {
      params: {},
      query: {
        reference: 'phase',
        referenceId: '2001',
      },
      body: {},
    };

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.params.projectId).toBe('1002');
  });

  it('throws bad request when only reference is provided', async () => {
    const request: any = {
      params: {},
      query: {
        reference: 'project',
      },
      body: {},
    };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
