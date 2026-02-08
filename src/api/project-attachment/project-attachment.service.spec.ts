import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttachmentType } from '@prisma/client';
import { Permission } from 'src/shared/constants/permissions';
import { KAFKA_TOPIC } from 'src/shared/config/kafka.config';
import { FileService } from 'src/shared/services/file.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { ProjectAttachmentService } from './project-attachment.service';

jest.mock('src/shared/utils/event.utils', () => ({
  publishAttachmentEvent: jest.fn(() => Promise.resolve()),
  publishNotificationEvent: jest.fn(() => Promise.resolve()),
}));

const eventUtils = jest.requireMock('src/shared/utils/event.utils');

describe('ProjectAttachmentService', () => {
  const prismaMock = {
    project: {
      findFirst: jest.fn(),
    },
    projectAttachment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const permissionServiceMock = {
    hasNamedPermission: jest.fn(),
  };

  const fileServiceMock = {
    getPresignedDownloadUrl: jest.fn(),
    transferFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  let service: ProjectAttachmentService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ProjectAttachmentService(
      prismaMock as any,
      permissionServiceMock as unknown as PermissionService,
      fileServiceMock as unknown as FileService,
    );

    fileServiceMock.getPresignedDownloadUrl.mockResolvedValue(
      'https://download.example.com/default',
    );
    fileServiceMock.transferFile.mockResolvedValue(undefined);
    fileServiceMock.deleteFile.mockResolvedValue(undefined);

    prismaMock.project.findFirst.mockResolvedValue({
      id: BigInt(1001),
      members: [
        {
          userId: BigInt(123),
          role: 'manager',
          deletedAt: null,
        },
      ],
    });
  });

  it('creates link attachment and publishes event', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.CREATE_PROJECT_ATTACHMENT) {
          return true;
        }

        return false;
      },
    );

    prismaMock.projectAttachment.create.mockResolvedValue({
      id: BigInt(77),
      projectId: BigInt(1001),
      title: 'Spec Link',
      type: AttachmentType.link,
      path: 'https://example.com',
      size: null,
      category: null,
      description: null,
      contentType: null,
      tags: ['docs'],
      allowedUsers: [],
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    const response = await service.createAttachment(
      '1001',
      {
        title: 'Spec Link',
        path: 'https://example.com',
        type: AttachmentType.link,
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(response.id).toBe('77');
    expect(prismaMock.projectAttachment.create).toHaveBeenCalled();
    expect(eventUtils.publishAttachmentEvent).toHaveBeenCalled();
    expect(eventUtils.publishNotificationEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_LINK_CREATED,
      expect.any(Object),
    );
  });

  it('creates file attachment with presigned URL and async transfer', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.CREATE_PROJECT_ATTACHMENT) {
          return true;
        }

        return false;
      },
    );

    fileServiceMock.getPresignedDownloadUrl.mockResolvedValue(
      'https://download.example.com',
    );
    fileServiceMock.transferFile.mockResolvedValue(undefined);

    prismaMock.projectAttachment.create.mockResolvedValue({
      id: BigInt(91),
      projectId: BigInt(1001),
      title: 'Spec File',
      type: AttachmentType.file,
      path: 'projects/1001/projects/source.zip',
      size: 10,
      category: null,
      description: null,
      contentType: 'application/zip',
      tags: ['archive'],
      allowedUsers: [],
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    const response = await service.createAttachment(
      '1001',
      {
        title: 'Spec File',
        path: 'tmp/source.zip',
        type: AttachmentType.file,
        s3Bucket: 'incoming-bucket',
        contentType: 'application/zip',
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(response.downloadUrl).toBe('https://download.example.com');
    expect(fileServiceMock.getPresignedDownloadUrl).toHaveBeenCalled();
    expect(fileServiceMock.transferFile).toHaveBeenCalledWith(
      'incoming-bucket',
      'tmp/source.zip',
      expect.any(String),
      expect.any(String),
    );
    expect(eventUtils.publishAttachmentEvent).toHaveBeenCalled();
    expect(eventUtils.publishNotificationEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_FILE_UPLOADED,
      expect.any(Object),
    );
  });

  it('returns not found when attachment is restricted for current user', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.VIEW_PROJECT_ATTACHMENT) {
          return true;
        }

        if (permission === Permission.READ_PROJECT_ANY) {
          return false;
        }

        return false;
      },
    );

    prismaMock.projectAttachment.findFirst.mockResolvedValue({
      id: BigInt(19),
      projectId: BigInt(1001),
      title: 'Restricted',
      type: AttachmentType.link,
      path: 'https://example.com',
      size: null,
      category: null,
      description: null,
      contentType: null,
      tags: [],
      allowedUsers: [777],
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    await expect(
      service.getAttachment('1001', '19', {
        userId: '123',
        isMachine: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates attachment fields without requiring title on patch payload', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.EDIT_PROJECT_ATTACHMENT) {
          return true;
        }

        return false;
      },
    );

    prismaMock.projectAttachment.findFirst.mockResolvedValue({
      id: BigInt(22),
      projectId: BigInt(1001),
      title: 'Original',
      type: AttachmentType.file,
      path: 'projects/1001/projects/original.txt',
      size: null,
      category: null,
      description: null,
      contentType: 'text/plain',
      tags: ['legacy'],
      allowedUsers: [],
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    prismaMock.projectAttachment.update.mockResolvedValue({
      id: BigInt(22),
      projectId: BigInt(1001),
      title: 'Original',
      type: AttachmentType.file,
      path: 'projects/1001/projects/original.txt',
      size: null,
      category: null,
      description: null,
      contentType: 'text/plain',
      tags: ['release'],
      allowedUsers: [111, 222],
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    await service.updateAttachment(
      '1001',
      '22',
      {
        allowedUsers: [111, 222],
        tags: ['release'],
      },
      {
        userId: '123',
        isMachine: false,
      },
    );

    expect(prismaMock.projectAttachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: undefined,
          allowedUsers: [111, 222],
          tags: ['release'],
        }),
      }),
    );
    expect(eventUtils.publishNotificationEvent).toHaveBeenCalledWith(
      KAFKA_TOPIC.PROJECT_ATTACHMENT_UPDATED_NOTIFICATION,
      expect.any(Object),
    );
  });

  it('deletes file attachment and triggers async file removal', async () => {
    permissionServiceMock.hasNamedPermission.mockImplementation(
      (permission: Permission): boolean => {
        if (permission === Permission.DELETE_PROJECT_ATTACHMENT) {
          return true;
        }

        return false;
      },
    );

    prismaMock.projectAttachment.findFirst.mockResolvedValue({
      id: BigInt(20),
      projectId: BigInt(1001),
      title: 'Doc',
      type: AttachmentType.file,
      path: 'projects/1001/projects/file.txt',
      size: null,
      category: null,
      description: null,
      contentType: 'text/plain',
      tags: [],
      allowedUsers: [],
      deletedAt: null,
      deletedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    prismaMock.projectAttachment.update.mockResolvedValue({
      id: BigInt(20),
      projectId: BigInt(1001),
      title: 'Doc',
      type: AttachmentType.file,
      path: 'projects/1001/projects/file.txt',
      size: null,
      category: null,
      description: null,
      contentType: 'text/plain',
      tags: [],
      allowedUsers: [],
      deletedAt: new Date(),
      deletedBy: BigInt(123),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 123,
      updatedBy: 123,
    });

    await service.deleteAttachment('1001', '20', {
      userId: '123',
      isMachine: false,
    });

    expect(fileServiceMock.deleteFile).toHaveBeenCalled();
    expect(eventUtils.publishAttachmentEvent).toHaveBeenCalled();
  });

  it('throws forbidden when create permission is missing', async () => {
    permissionServiceMock.hasNamedPermission.mockReturnValue(false);

    await expect(
      service.createAttachment(
        '1001',
        {
          title: 'Spec Link',
          path: 'https://example.com',
          type: AttachmentType.link,
        },
        {
          userId: '123',
          isMachine: false,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
