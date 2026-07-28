import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectPostIndustryService } from './project-post-industry.service';

describe('ProjectPostIndustryService', () => {
  const prismaMock = {
    projectPostIndustry: {
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

  let service: ProjectPostIndustryService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectPostIndustryService(
      prismaMock as any,
      prismaErrorServiceMock as any,
      eventBusServiceMock as any,
    );
  });

  it('finds all industries', async () => {
    prismaMock.projectPostIndustry.findMany.mockResolvedValue([
      { id: BigInt(1), name: 'Finance' },
    ]);

    const response = await service.findAll();

    expect(response).toEqual([{ id: '1', name: 'Finance' }]);
  });

  it('finds an industry by id', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue({
      id: BigInt(2),
      name: 'Design',
    });

    const response = await service.findById('2');

    expect(response).toEqual({ id: '2', name: 'Design' });
  });

  it('throws NotFoundException for invalid id when finding an industry', async () => {
    await expect(service.findById('abc')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when industry does not exist', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue(undefined);

    await expect(service.findById('5')).rejects.toThrow(NotFoundException);
  });

  it('creates a new industry', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue(undefined);
    prismaMock.projectPostIndustry.create.mockResolvedValue({
      id: BigInt(3),
      name: 'Marketing',
    });

    const response = await service.create({ name: 'Marketing' }, 100);

    expect(prismaMock.projectPostIndustry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Marketing' },
      }),
    );
    expect(response).toEqual({ id: '3', name: 'Marketing' });
  });

  it('throws ConflictException when creating a duplicate industry', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue({
      id: BigInt(4),
      name: 'Finance',
    });

    await expect(service.create({ name: 'Finance' }, 100)).rejects.toThrow(
      ConflictException,
    );
  });

  it('updates an existing industry', async () => {
    prismaMock.projectPostIndustry.findFirst
      .mockResolvedValueOnce({ id: BigInt(5), name: 'Finance' })
      .mockResolvedValueOnce({ id: BigInt(5), name: 'Growth' });
    prismaMock.projectPostIndustry.update.mockResolvedValue({
      id: BigInt(5),
      name: 'Growth',
    });

    const response = await service.update('5', { name: 'Growth' }, 100);

    expect(response).toEqual({ id: '5', name: 'Growth' });
    expect(prismaMock.projectPostIndustry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(5) },
        data: { name: 'Growth' },
      }),
    );
  });

  it('throws NotFoundException when updating invalid id', async () => {
    await expect(service.update('abc', { name: 'Any' }, 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when updating missing industry', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue(undefined);

    await expect(service.update('7', { name: 'Any' }, 100)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes an existing industry', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue({
      id: BigInt(9),
    });
    prismaMock.projectPostIndustry.delete.mockResolvedValue(undefined);

    await service.delete('9', 100);

    expect(prismaMock.projectPostIndustry.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BigInt(9) } }),
    );
  });

  it('throws NotFoundException when deleting invalid id', async () => {
    await expect(service.delete('abc', 100)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when deleting missing industry', async () => {
    prismaMock.projectPostIndustry.findFirst.mockResolvedValue(undefined);

    await expect(service.delete('10', 100)).rejects.toThrow(NotFoundException);
  });
});
