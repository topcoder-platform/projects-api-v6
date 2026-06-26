import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectPostCategoryService } from './project-post-category.service';

describe('ProjectPostCategoryService', () => {
  const prismaMock = {
    projectPostCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const prismaErrorServiceMock = {
    handleError: jest.fn(),
  };

  const eventBusServiceMock = {};

  let service: ProjectPostCategoryService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectPostCategoryService(
      prismaMock as any,
      prismaErrorServiceMock as any,
      eventBusServiceMock as any,
    );
  });

  it('finds all categories', async () => {
    prismaMock.projectPostCategory.findMany.mockResolvedValue([
      { id: BigInt(1), name: 'Design' },
    ]);

    const response = await service.findAll();

    expect(response).toEqual([{ id: '1', name: 'Design' }]);
  });

  it('finds a category by id', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue({
      id: BigInt(2),
      name: 'Product',
    });

    const response = await service.findById('2');

    expect(response).toEqual({ id: '2', name: 'Product' });
  });

  it('throws NotFoundException for invalid id when finding a category', async () => {
    await expect(service.findById('abc')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when category does not exist', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue(undefined);

    await expect(service.findById('5')).rejects.toThrow(NotFoundException);
  });

  it('creates a new category', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue(undefined);
    prismaMock.projectPostCategory.create.mockResolvedValue({
      id: BigInt(3),
      name: 'Growth',
    });

    const response = await service.create({ name: 'Growth' }, 100);

    expect(prismaMock.projectPostCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Growth' },
      }),
    );
    expect(response).toEqual({ id: '3', name: 'Growth' });
  });

  it('throws ConflictException when creating duplicate category', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue({
      id: BigInt(4),
      name: 'Design',
    });

    await expect(service.create({ name: 'Design' }, 100)).rejects.toThrow(
      ConflictException,
    );
  });

  it('updates an existing category', async () => {
    prismaMock.projectPostCategory.findFirst
      .mockResolvedValueOnce({ id: BigInt(5), name: 'Design' })
      .mockResolvedValueOnce({ id: BigInt(5), name: 'Brand' });
    prismaMock.projectPostCategory.update.mockResolvedValue({
      id: BigInt(5),
      name: 'Brand',
    });

    const response = await service.update('5', { name: 'Brand' }, 100);

    expect(response).toEqual({ id: '5', name: 'Brand' });
    expect(prismaMock.projectPostCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(5) },
        data: { name: 'Brand' },
      }),
    );
  });

  it('throws NotFoundException when updating invalid id', async () => {
    await expect(service.update('abc', { name: 'Any' }, 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when updating missing category', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue(undefined);

    await expect(service.update('7', { name: 'Any' }, 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes an existing category', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue({
      id: BigInt(9),
    });
    prismaMock.projectPostCategory.delete.mockResolvedValue(undefined);

    await service.delete('9', 100);

    expect(prismaMock.projectPostCategory.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(9) } }),
    );
  });

  it('throws NotFoundException when deleting invalid id', async () => {
    await expect(service.delete('abc', 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when deleting missing category', async () => {
    prismaMock.projectPostCategory.findFirst.mockResolvedValue(undefined);

    await expect(service.delete('10', 100)).rejects.toThrow(
      NotFoundException,
    );
  });
});
