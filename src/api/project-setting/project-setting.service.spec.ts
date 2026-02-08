import { ProjectSettingService } from './project-setting.service';

describe('ProjectSettingService', () => {
  const prismaMock = {
    project: {
      findUnique: jest.fn(),
    },
    projectSetting: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const permissionServiceMock = {
    hasPermission: jest.fn(),
  };

  let service: ProjectSettingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectSettingService(
      prismaMock as never,
      permissionServiceMock as never,
    );

    permissionServiceMock.hasPermission.mockReturnValue(true);
    prismaMock.project.findUnique.mockResolvedValue({
      id: BigInt(1001),
    });
  });

  it('creates setting', async () => {
    prismaMock.projectSetting.findFirst.mockResolvedValue(null);
    prismaMock.projectSetting.create.mockResolvedValue({
      id: BigInt(11),
      projectId: BigInt(1001),
      key: 'region',
      value: 'US',
      valueType: 'string',
      metadata: {},
      readPermission: {},
      writePermission: {},
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    await service.create(
      '1001',
      {
        key: 'region',
        value: 'US',
        valueType: 'string' as never,
        readPermission: {},
        writePermission: {},
      },
      { userId: '123', isMachine: false },
      [],
    );

    expect(prismaMock.projectSetting.create).toHaveBeenCalled();
  });

  it('updates and deletes setting', async () => {
    prismaMock.projectSetting.findFirst.mockResolvedValue({
      id: BigInt(11),
      projectId: BigInt(1001),
      key: 'region',
      value: 'US',
      valueType: 'string',
      metadata: {},
      readPermission: {},
      writePermission: {},
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });
    prismaMock.projectSetting.update
      .mockResolvedValueOnce({
        id: BigInt(11),
        projectId: BigInt(1001),
        key: 'region',
        value: 'EU',
        valueType: 'string',
        metadata: {},
        readPermission: {},
        writePermission: {},
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 123,
        updatedBy: 123,
      })
      .mockResolvedValueOnce({
        id: BigInt(11),
        projectId: BigInt(1001),
        key: 'region',
        value: 'EU',
        valueType: 'string',
        metadata: {},
        readPermission: {},
        writePermission: {},
        deletedAt: new Date(),
        deletedBy: 123,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 123,
        updatedBy: 123,
      });

    await service.update(
      '1001',
      '11',
      {
        value: 'EU',
      },
      { userId: '123', isMachine: false },
      [],
    );

    await service.delete('1001', '11', { userId: '123', isMachine: false }, []);

    expect(prismaMock.projectSetting.update).toHaveBeenCalledTimes(2);
  });

  it('returns created setting response', async () => {
    prismaMock.projectSetting.findFirst.mockResolvedValue(null);
    prismaMock.projectSetting.create.mockResolvedValue({
      id: BigInt(12),
      projectId: BigInt(1001),
      key: 'timezone',
      value: 'UTC',
      valueType: 'string',
      metadata: {},
      readPermission: {},
      writePermission: {},
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    const result = await service.create(
      '1001',
      {
        key: 'timezone',
        value: 'UTC',
        valueType: 'string' as never,
        readPermission: {},
        writePermission: {},
      },
      { userId: '123', isMachine: false },
      [],
    );

    expect(result.id).toBe('12');
  });
});
