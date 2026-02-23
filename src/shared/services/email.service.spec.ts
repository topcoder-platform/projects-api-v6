import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const eventBusServiceMock = {
    publishProjectEvent: jest.fn(),
  };

  const originalEnv = process.env;
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    eventBusServiceMock.publishProjectEvent.mockResolvedValue(undefined);
    service = new EmailService(
      eventBusServiceMock as unknown as EventBusService,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses known-user invite template when isSSO=true', async () => {
    process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID =
      'known-template-id';
    process.env.SENDGRID_PROJECT_INVITATION_UNKNOWN_USER_TEMPLATE_ID =
      'unknown-template-id';

    await service.sendInviteEmail(
      '1001',
      {
        email: 'KnownUser@topcoder.com',
      },
      {
        userId: '123',
        handle: 'pm',
      },
      'Demo',
      {
        isSSO: true,
      },
    );

    expect(eventBusServiceMock.publishProjectEvent).toHaveBeenCalledTimes(1);
    const [topic, payload] =
      eventBusServiceMock.publishProjectEvent.mock.calls[0];
    const normalizedPayload = payload as {
      sendgrid_template_id?: string;
      recipients?: string[];
      data?: {
        projects?: Array<{
          sections?: Array<{ isSSO?: boolean }>;
        }>;
      };
    };

    expect(topic).toBe('external.action.email');
    expect(normalizedPayload.sendgrid_template_id).toBe('known-template-id');
    expect(normalizedPayload.recipients).toEqual(['knownuser@topcoder.com']);
    expect(normalizedPayload.data?.projects?.[0]?.sections?.[0]?.isSSO).toBe(
      true,
    );
  });

  it('uses unknown-user invite template when isSSO=false', async () => {
    process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID =
      'known-template-id';
    process.env.SENDGRID_PROJECT_INVITATION_UNKNOWN_USER_TEMPLATE_ID =
      'unknown-template-id';

    await service.sendInviteEmail(
      '1001',
      {
        email: 'unknown@topcoder.com',
      },
      {
        userId: '123',
        handle: 'pm',
      },
      'Demo',
      {
        isSSO: false,
      },
    );

    expect(eventBusServiceMock.publishProjectEvent).toHaveBeenCalledTimes(1);
    const [, payload] = eventBusServiceMock.publishProjectEvent.mock.calls[0];
    const normalizedPayload = payload as {
      sendgrid_template_id?: string;
      data?: {
        projects?: Array<{
          sections?: Array<{ isSSO?: boolean }>;
        }>;
      };
    };

    expect(normalizedPayload.sendgrid_template_id).toBe('unknown-template-id');
    expect(normalizedPayload.data?.projects?.[0]?.sections?.[0]?.isSSO).toBe(
      false,
    );
  });

  it('falls back to legacy invite template when dedicated template is missing', async () => {
    process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED = 'legacy-template-id';

    await service.sendInviteEmail(
      '1001',
      {
        email: 'known@topcoder.com',
      },
      {
        userId: '123',
        handle: 'pm',
      },
      'Demo',
      {
        isSSO: true,
      },
    );

    expect(eventBusServiceMock.publishProjectEvent).toHaveBeenCalledTimes(1);
    const [, payload] = eventBusServiceMock.publishProjectEvent.mock.calls[0];
    expect(
      (payload as { sendgrid_template_id?: string }).sendgrid_template_id,
    ).toBe('legacy-template-id');
  });

  it('skips publish when no invite template is configured', async () => {
    delete process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID;
    delete process.env.SENDGRID_PROJECT_INVITATION_UNKNOWN_USER_TEMPLATE_ID;
    delete process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED;

    await service.sendInviteEmail(
      '1001',
      {
        email: 'known@topcoder.com',
      },
      {
        userId: '123',
        handle: 'pm',
      },
      'Demo',
      {
        isSSO: true,
      },
    );

    expect(eventBusServiceMock.publishProjectEvent).not.toHaveBeenCalled();
  });
});
