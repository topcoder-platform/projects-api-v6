import {
  CopilotApplication,
  CopilotApplicationStatus,
  CopilotOpportunity,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import { MemberService } from 'src/shared/services/member.service';
import { CopilotNotificationService } from './copilot-notification.service';

describe('CopilotNotificationService', () => {
  const originalSlackEmail = process.env.COPILOTS_SLACK_EMAIL;
  const memberServiceMock = {
    getRoleSubjects: jest.fn(),
    getMemberDetailsByUserIds: jest.fn(),
  };

  const eventBusServiceMock = {
    publishProjectEvent: jest.fn(),
  };

  let service: CopilotNotificationService;

  function createOpportunity(): CopilotOpportunity & { copilotRequest: any } {
    const now = new Date('2025-01-01T00:00:00.000Z');

    return {
      id: BigInt(21),
      projectId: BigInt(1001),
      copilotRequestId: BigInt(301),
      status: CopilotOpportunityStatus.active,
      type: CopilotOpportunityType.dev,
      createdAt: now,
      updatedAt: now,
      createdBy: 777,
      updatedBy: 777,
      deletedAt: null,
      deletedBy: null,
      copilotRequest: {
        data: {
          projectType: 'dev',
          opportunityTitle: 'Need migration copilot',
        },
      },
    };
  }

  function createApplication(): CopilotApplication {
    const now = new Date('2025-01-01T00:00:00.000Z');

    return {
      id: BigInt(501),
      opportunityId: BigInt(21),
      userId: BigInt(999),
      notes: 'I can help',
      status: CopilotApplicationStatus.pending,
      createdAt: now,
      updatedAt: now,
      createdBy: 999,
      updatedBy: 999,
      deletedAt: null,
      deletedBy: null,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COPILOTS_SLACK_EMAIL = '';
    memberServiceMock.getRoleSubjects.mockResolvedValue([]);
    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([]);
    eventBusServiceMock.publishProjectEvent.mockResolvedValue(undefined);

    service = new CopilotNotificationService(
      memberServiceMock as unknown as MemberService,
      eventBusServiceMock as unknown as EventBusService,
    );
  });

  afterAll(() => {
    process.env.COPILOTS_SLACK_EMAIL = originalSlackEmail;
  });

  it('publishes apply notifications to all PM users and opportunity creator', async () => {
    memberServiceMock.getRoleSubjects.mockResolvedValue([
      { email: 'pm1@topcoder.com', handle: 'pm1' },
      { email: 'creator@topcoder.com', handle: 'pm-creator' },
    ]);
    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([
      { email: 'Creator@topcoder.com', handle: 'creator-user' },
    ]);

    await service.sendCopilotApplicationNotification(
      createOpportunity(),
      createApplication(),
    );

    expect(memberServiceMock.getRoleSubjects).toHaveBeenCalledWith(
      UserRole.PROJECT_MANAGER,
    );
    expect(memberServiceMock.getMemberDetailsByUserIds).toHaveBeenCalledWith([
      777,
    ]);
    expect(eventBusServiceMock.publishProjectEvent).toHaveBeenCalledTimes(2);

    const recipients = eventBusServiceMock.publishProjectEvent.mock.calls
      .map(([, payload]) => (payload as { recipients?: string[] }).recipients)
      .map((recipientList) => recipientList?.[0])
      .sort();

    expect(recipients).toEqual(['creator@topcoder.com', 'pm1@topcoder.com']);

    for (const [topic, payload] of eventBusServiceMock.publishProjectEvent.mock
      .calls) {
      const normalizedPayload = payload as {
        sendgrid_template_id?: string;
        version?: string;
      };

      expect(topic).toBe('external.action.email');
      expect(normalizedPayload.sendgrid_template_id).toBe(
        'd-d7c1f48628654798a05c8e09e52db14f',
      );
      expect(normalizedPayload.version).toBe('v3');
    }
  });

  it('does not throw when publishing apply notification fails', async () => {
    memberServiceMock.getRoleSubjects.mockResolvedValue([
      { email: 'pm1@topcoder.com', handle: 'pm1' },
    ]);
    eventBusServiceMock.publishProjectEvent.mockRejectedValue(
      new Error('Event bus unavailable'),
    );

    await expect(
      service.sendCopilotApplicationNotification(
        createOpportunity(),
        createApplication(),
      ),
    ).resolves.toBeUndefined();
  });

  it('resolves copilot recipient emails from userIds for new-opportunity notification', async () => {
    memberServiceMock.getRoleSubjects.mockResolvedValue([
      { userId: 4001, handle: 'copilot1' },
      { userId: 4002, handle: 'copilot2' },
    ]);
    memberServiceMock.getMemberDetailsByUserIds.mockResolvedValue([
      { userId: 4001, handle: 'copilot1', email: 'copilot1@topcoder.com' },
      { userId: 4002, handle: 'copilot2', email: 'copilot2@topcoder.com' },
    ]);

    const opportunity = createOpportunity();
    await service.sendOpportunityPostedNotification(
      opportunity,
      opportunity.copilotRequest,
    );

    expect(memberServiceMock.getRoleSubjects).toHaveBeenCalledWith(
      UserRole.TC_COPILOT,
    );
    expect(memberServiceMock.getMemberDetailsByUserIds).toHaveBeenCalledWith([
      '4001',
      '4002',
    ]);
    expect(eventBusServiceMock.publishProjectEvent).toHaveBeenCalledTimes(2);

    const recipients = eventBusServiceMock.publishProjectEvent.mock.calls
      .map(([, payload]) => (payload as { recipients?: string[] }).recipients)
      .map((recipientList) => recipientList?.[0])
      .sort();

    expect(recipients).toEqual([
      'copilot1@topcoder.com',
      'copilot2@topcoder.com',
    ]);
  });

  it('resolves PM recipient emails from userIds for application notification', async () => {
    memberServiceMock.getRoleSubjects.mockResolvedValue([
      { userId: 5001, handle: 'pm1' },
    ]);
    memberServiceMock.getMemberDetailsByUserIds.mockImplementation(
      (userIds: Array<number | string>) => {
        if (userIds.length === 1 && String(userIds[0]) === '777') {
          return Promise.resolve([
            { userId: 777, handle: 'creator', email: 'creator@topcoder.com' },
          ]);
        }

        return Promise.resolve([
          { userId: 5001, handle: 'pm1', email: 'pm1@topcoder.com' },
        ]);
      },
    );

    await service.sendCopilotApplicationNotification(
      createOpportunity(),
      createApplication(),
    );

    expect(eventBusServiceMock.publishProjectEvent).toHaveBeenCalledTimes(2);

    const recipients = eventBusServiceMock.publishProjectEvent.mock.calls
      .map(([, payload]) => (payload as { recipients?: string[] }).recipients)
      .map((recipientList) => recipientList?.[0])
      .sort();

    expect(recipients).toEqual(['creator@topcoder.com', 'pm1@topcoder.com']);
  });
});
