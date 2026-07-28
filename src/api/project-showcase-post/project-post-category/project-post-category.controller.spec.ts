import { ProjectPostCategoryController } from './project-post-category.controller';

describe('ProjectPostCategoryController', () => {
  const serviceMock = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  let controller: ProjectPostCategoryController;
  const user = { userId: '42', isMachine: false, tokenPayload: {} } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectPostCategoryController(serviceMock as any);
  });

  it('lists categories', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: '1', name: 'Design' }]);

    const response = await controller.list();

    expect(response).toEqual([{ id: '1', name: 'Design' }]);
    expect(serviceMock.findAll).toHaveBeenCalled();
  });

  it('gets a category by id', async () => {
    serviceMock.findById.mockResolvedValue({ id: '2', name: 'Product' });

    const response = await controller.getOne('2');

    expect(response).toEqual({ id: '2', name: 'Product' });
    expect(serviceMock.findById).toHaveBeenCalledWith('2');
  });

  it('creates a category', async () => {
    serviceMock.create.mockResolvedValue({ id: '3', name: 'Growth' });

    const response = await controller.create({ name: 'Growth' }, user);

    expect(response).toEqual({ id: '3', name: 'Growth' });
    expect(serviceMock.create).toHaveBeenCalled();
  });

  it('updates a category', async () => {
    serviceMock.update.mockResolvedValue({ id: '4', name: 'Brand' });

    const response = await controller.update('4', { name: 'Brand' }, user);

    expect(response).toEqual({ id: '4', name: 'Brand' });
    expect(serviceMock.update).toHaveBeenCalled();
  });

  it('deletes a category', async () => {
    serviceMock.delete.mockResolvedValue(undefined);

    await controller.delete('5', user);

    expect(serviceMock.delete).toHaveBeenCalledWith('5', expect.any(Number));
  });
});
