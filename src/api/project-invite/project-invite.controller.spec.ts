import { InviteStatus, ProjectMemberRole } from '@prisma/client';
import { Response } from 'express';
import { ProjectInviteController } from './project-invite.controller';
import { ProjectInviteService } from './project-invite.service';

describe('ProjectInviteController', () => {
  const serviceMock = {
    listInvites: jest.fn(),
    createInvites: jest.fn(),
    updateInvite: jest.fn(),
    deleteInvite: jest.fn(),
    getInvite: jest.fn(),
  };

  let controller: ProjectInviteController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectInviteController(
      serviceMock as unknown as ProjectInviteService,
    );
  });

  it('lists invites', async () => {
    serviceMock.listInvites.mockResolvedValue([{ id: '1' }]);

    const response = await controller.listInvites(
      '123',
      {
        fields: 'handle,email',
      },
      {
        userId: '10',
        isMachine: false,
      },
    );

    expect(response).toHaveLength(1);
    expect(serviceMock.listInvites).toHaveBeenCalled();
  });

  it('creates invites and sets 201', async () => {
    serviceMock.createInvites.mockResolvedValue({
      success: [{ id: '1' }],
    });

    const statusMock = jest.fn();
    const resMock = {
      status: statusMock,
    } as unknown as Response;

    const response = await controller.createInvites(
      '123',
      {
        handles: ['member'],
        role: ProjectMemberRole.customer,
      },
      undefined,
      {
        userId: '10',
        isMachine: false,
      },
      resMock,
    );

    expect(response.success).toHaveLength(1);
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('updates invite', async () => {
    serviceMock.updateInvite.mockResolvedValue({ id: '2' });

    const response = await controller.updateInvite(
      '123',
      '2',
      {
        status: InviteStatus.accepted,
      },
      undefined,
      {
        userId: '10',
        isMachine: false,
      },
    );

    expect(response).toEqual({ id: '2' });
  });

  it('deletes invite', async () => {
    serviceMock.deleteInvite.mockResolvedValue(undefined);

    await controller.deleteInvite('123', '2', {
      userId: '10',
      isMachine: false,
    });

    expect(serviceMock.deleteInvite).toHaveBeenCalled();
  });

  it('gets invite', async () => {
    serviceMock.getInvite.mockResolvedValue({ id: '2' });

    const response = await controller.getInvite(
      '123',
      '2',
      {
        fields: 'handle',
      },
      {
        userId: '10',
        isMachine: false,
      },
    );

    expect(response).toEqual({ id: '2' });
  });
});
