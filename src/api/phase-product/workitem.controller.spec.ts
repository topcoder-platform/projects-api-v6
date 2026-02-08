import { NotFoundException } from '@nestjs/common';
import { WorkItemController } from './workitem.controller';
import { PhaseProductService } from './phase-product.service';
import { WorkStreamService } from '../workstream/workstream.service';

describe('WorkItemController', () => {
  const phaseProductServiceMock = {
    listPhaseProducts: jest.fn(),
    getPhaseProduct: jest.fn(),
    createPhaseProduct: jest.fn(),
    updatePhaseProduct: jest.fn(),
    deletePhaseProduct: jest.fn(),
  };

  const workStreamServiceMock = {
    ensurePhaseLinkedToWorkStream: jest.fn(),
  };

  let controller: WorkItemController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WorkItemController(
      phaseProductServiceMock as unknown as PhaseProductService,
      workStreamServiceMock as unknown as WorkStreamService,
    );
  });

  it('validates work/workstream linkage before creating work item', async () => {
    workStreamServiceMock.ensurePhaseLinkedToWorkStream.mockResolvedValue(
      undefined,
    );
    phaseProductServiceMock.createPhaseProduct.mockResolvedValue({ id: '1' });

    const result = await controller.createWorkItem(
      '1001',
      '2001',
      '3001',
      {
        name: 'Specification',
        type: 'document',
      },
      {
        userId: '123',
      } as never,
    );

    expect(result).toEqual({ id: '1' });
    expect(
      workStreamServiceMock.ensurePhaseLinkedToWorkStream,
    ).toHaveBeenCalledWith('1001', '2001', '3001');
  });

  it('returns not found when work is not linked to work stream', async () => {
    workStreamServiceMock.ensurePhaseLinkedToWorkStream.mockRejectedValue(
      new NotFoundException('missing link'),
    );

    await expect(
      controller.createWorkItem(
        '1001',
        '2001',
        '3001',
        {
          name: 'Specification',
          type: 'document',
        },
        {
          userId: '123',
        } as never,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(phaseProductServiceMock.createPhaseProduct).not.toHaveBeenCalled();
  });
});
