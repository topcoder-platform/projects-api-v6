import { WorkStreamStatus } from '@prisma/client';
import { WorkStreamController } from './workstream.controller';
import { WorkStreamService } from './workstream.service';

describe('WorkStreamController', () => {
  const serviceMock = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  let controller: WorkStreamController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WorkStreamController(
      serviceMock as unknown as WorkStreamService,
    );
  });

  it('lists work streams', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: '1' }]);

    const result = await controller.listWorkStreams('1001', {
      page: 1,
      perPage: 20,
    });

    expect(result).toEqual([{ id: '1' }]);
    expect(serviceMock.findAll).toHaveBeenCalledWith('1001', {
      page: 1,
      perPage: 20,
    });
  });

  it('creates a work stream', async () => {
    serviceMock.create.mockResolvedValue({ id: '11' });

    const result = await controller.createWorkStream(
      '1001',
      {
        name: 'Delivery',
        type: 'app',
        status: WorkStreamStatus.active,
      },
      {
        userId: '123',
      } as never,
    );

    expect(result).toEqual({ id: '11' });
    expect(serviceMock.create).toHaveBeenCalledWith(
      '1001',
      {
        name: 'Delivery',
        type: 'app',
        status: WorkStreamStatus.active,
      },
      '123',
    );
  });

  it('deletes a work stream', async () => {
    serviceMock.delete.mockResolvedValue(undefined);

    await controller.deleteWorkStream('1001', '77', {
      userId: '123',
    } as never);

    expect(serviceMock.delete).toHaveBeenCalledWith('1001', '77', '123');
  });
});
