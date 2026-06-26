import { ProjectPostIndustryController } from './project-post-industry.controller';

describe('ProjectPostIndustryController', () => {
  const serviceMock = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  let controller: ProjectPostIndustryController;
  const user = { userId: '42', isMachine: false, tokenPayload: {} } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectPostIndustryController(
      serviceMock as any,
    );
  });

  it('lists industries', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: '1', name: 'Finance' }]);

    const response = await controller.list();

    expect(response).toEqual([{ id: '1', name: 'Finance' }]);
    expect(serviceMock.findAll).toHaveBeenCalled();
  });

  it('gets an industry by id', async () => {
    serviceMock.findById.mockResolvedValue({ id: '2', name: 'Design' });

    const response = await controller.getOne('2');

    expect(response).toEqual({ id: '2', name: 'Design' });
    expect(serviceMock.findById).toHaveBeenCalledWith('2');
  });

  it('creates an industry', async () => {
    serviceMock.create.mockResolvedValue({ id: '3', name: 'Marketing' });

    const response = await controller.create(
      { name: 'Marketing' },
      user,
    );

    expect(response).toEqual({ id: '3', name: 'Marketing' });
    expect(serviceMock.create).toHaveBeenCalled();
  });

  it('updates an industry', async () => {
    serviceMock.update.mockResolvedValue({ id: '4', name: 'Growth' });

    const response = await controller.update('4', { name: 'Growth' }, user);

    expect(response).toEqual({ id: '4', name: 'Growth' });
    expect(serviceMock.update).toHaveBeenCalled();
  });

  it('deletes an industry', async () => {
    serviceMock.delete.mockResolvedValue(undefined);

    await controller.delete('5', user);

    expect(serviceMock.delete).toHaveBeenCalledWith('5', expect.any(Number));
  });
});
