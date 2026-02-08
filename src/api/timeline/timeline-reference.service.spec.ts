import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TimelineReference } from '@prisma/client';
import { TimelineReferenceService } from './timeline-reference.service';

describe('TimelineReferenceService', () => {
  const prismaMock = {
    project: {
      findFirst: jest.fn(),
    },
    projectPhase: {
      findFirst: jest.fn(),
    },
    phaseProduct: {
      findFirst: jest.fn(),
    },
    workStream: {
      findFirst: jest.fn(),
    },
    timeline: {
      findFirst: jest.fn(),
    },
  };

  let service: TimelineReferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TimelineReferenceService(prismaMock as any);
  });

  it('resolves project reference directly', async () => {
    prismaMock.project.findFirst.mockResolvedValue({ id: BigInt(1001) });

    const result = await service.resolveProjectContextByReference(
      TimelineReference.project,
      BigInt(1001),
    );

    expect(result.projectId).toBe(BigInt(1001));
  });

  it('resolves project id from phase reference', async () => {
    prismaMock.projectPhase.findFirst.mockResolvedValue({
      projectId: BigInt(1002),
    });

    const result = await service.resolveProjectContextByReference(
      TimelineReference.phase,
      BigInt(77),
    );

    expect(result.projectId).toBe(BigInt(1002));
  });

  it('resolves project id from product reference', async () => {
    prismaMock.phaseProduct.findFirst.mockResolvedValue({
      projectId: BigInt(1003),
    });

    const result = await service.resolveProjectContextByReference(
      TimelineReference.product,
      BigInt(88),
    );

    expect(result.projectId).toBe(BigInt(1003));
  });

  it('resolves project id from work reference', async () => {
    prismaMock.workStream.findFirst.mockResolvedValue({
      projectId: BigInt(1004),
    });

    const result = await service.resolveProjectContextByReference(
      TimelineReference.work,
      BigInt(99),
    );

    expect(result.projectId).toBe(BigInt(1004));
  });

  it('throws bad request when reference target does not exist', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveProjectContextByReference(
        TimelineReference.project,
        BigInt(1),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves by timeline id', async () => {
    prismaMock.timeline.findFirst.mockResolvedValue({
      id: BigInt(9),
      reference: TimelineReference.project,
      referenceId: BigInt(1001),
    });
    prismaMock.project.findFirst.mockResolvedValue({ id: BigInt(1001) });

    const result = await service.resolveProjectContextByTimelineId(BigInt(9));

    expect(result.timeline?.id).toBe(BigInt(9));
    expect(result.projectId).toBe(BigInt(1001));
  });

  it('throws not found when timeline id does not exist', async () => {
    prismaMock.timeline.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveProjectContextByTimelineId(BigInt(100)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('parses timeline references', () => {
    expect(service.parseTimelineReference('project')).toBe(
      TimelineReference.project,
    );

    expect(() => service.parseTimelineReference('invalid')).toThrow(
      BadRequestException,
    );
  });
});
