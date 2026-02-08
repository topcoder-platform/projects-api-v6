import { ProjectMemberRole } from '@prisma/client';
import { ProjectMemberController } from './project-member.controller';
import { ProjectMemberService } from './project-member.service';

describe('ProjectMemberController', () => {
  const serviceMock = {
    addMember: jest.fn(),
    updateMember: jest.fn(),
    deleteMember: jest.fn(),
    listMembers: jest.fn(),
    getMember: jest.fn(),
  };

  let controller: ProjectMemberController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectMemberController(
      serviceMock as unknown as ProjectMemberService,
    );
  });

  it('creates member', async () => {
    serviceMock.addMember.mockResolvedValue({ id: '1' });

    const response = await controller.addMember(
      '123',
      {
        role: ProjectMemberRole.manager,
      },
      'handle,email',
      {
        userId: '10',
        isMachine: false,
      },
    );

    expect(response).toEqual({ id: '1' });
    expect(serviceMock.addMember).toHaveBeenCalledWith(
      '123',
      expect.objectContaining({ role: ProjectMemberRole.manager }),
      expect.objectContaining({ userId: '10' }),
      'handle,email',
    );
  });

  it('updates member', async () => {
    serviceMock.updateMember.mockResolvedValue({ id: '2' });

    const response = await controller.updateMember(
      '123',
      '2',
      {
        role: ProjectMemberRole.customer,
      },
      undefined,
      {
        userId: '10',
        isMachine: false,
      },
    );

    expect(response).toEqual({ id: '2' });
    expect(serviceMock.updateMember).toHaveBeenCalled();
  });

  it('deletes member', async () => {
    serviceMock.deleteMember.mockResolvedValue(undefined);

    await controller.deleteMember('123', '2', {
      userId: '10',
      isMachine: false,
    });

    expect(serviceMock.deleteMember).toHaveBeenCalledWith(
      '123',
      '2',
      expect.objectContaining({ userId: '10' }),
    );
  });

  it('lists members', async () => {
    serviceMock.listMembers.mockResolvedValue([{ id: '1' }]);

    const response = await controller.listMembers(
      '123',
      {
        fields: 'handle',
      },
      {
        userId: '10',
        isMachine: false,
      },
    );

    expect(response).toHaveLength(1);
    expect(serviceMock.listMembers).toHaveBeenCalled();
  });

  it('gets member', async () => {
    serviceMock.getMember.mockResolvedValue({ id: '2' });

    const response = await controller.getMember(
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
    expect(serviceMock.getMember).toHaveBeenCalled();
  });
});
