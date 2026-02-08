import { NotFoundException } from '@nestjs/common';
import { WorkController } from './work.controller';
import { ProjectPhaseService } from './project-phase.service';
import { WorkStreamService } from '../workstream/workstream.service';

describe('WorkController', () => {
  const projectPhaseServiceMock = {
    listPhases: jest.fn(),
    getPhase: jest.fn(),
    createPhase: jest.fn(),
    updatePhase: jest.fn(),
    deletePhase: jest.fn(),
  };

  const workStreamServiceMock = {
    ensureWorkStreamExists: jest.fn(),
    listLinkedPhaseIds: jest.fn(),
    ensurePhaseLinkedToWorkStream: jest.fn(),
    createLink: jest.fn(),
  };

  let controller: WorkController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WorkController(
      projectPhaseServiceMock as unknown as ProjectPhaseService,
      workStreamServiceMock as unknown as WorkStreamService,
    );
  });

  it('applies phase-workstream linkage ids in the phase query', async () => {
    workStreamServiceMock.ensureWorkStreamExists.mockResolvedValue(undefined);
    workStreamServiceMock.listLinkedPhaseIds.mockResolvedValue([BigInt(2)]);
    projectPhaseServiceMock.listPhases.mockResolvedValue([
      { id: '2', name: 'Phase 2' },
    ]);

    const user = {
      userId: '123',
    } as never;

    const result = await controller.listWorks('1001', '2001', {}, user);

    expect(result).toEqual([{ id: '2', name: 'Phase 2' }]);
    expect(projectPhaseServiceMock.listPhases).toHaveBeenCalledWith(
      '1001',
      {},
      user,
      {
        phaseIds: [BigInt(2)],
      },
    );
  });

  it('validates work stream before creating work', async () => {
    workStreamServiceMock.ensureWorkStreamExists.mockRejectedValue(
      new NotFoundException('missing'),
    );

    await expect(
      controller.createWork(
        '1001',
        '999',
        {
          name: 'Implementation',
          status: 'active',
        } as never,
        {
          userId: '123',
        } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(projectPhaseServiceMock.createPhase).not.toHaveBeenCalled();
    expect(workStreamServiceMock.createLink).not.toHaveBeenCalled();
  });
});
