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
        id: 'inv-100',
        email: 'KnownUser@topcoder.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      {
        userId: '123',
        handle: 'pm',
        firstName: 'Jane',
        lastName: 'Smith',
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
      data?: Record<string, unknown>;
    };

    expect(topic).toBe('external.action.email');
    expect(normalizedPayload.sendgrid_template_id).toBe('known-template-id');
    expect(normalizedPayload.recipients).toEqual(['knownuser@topcoder.com']);
    expect(normalizedPayload.data).toEqual({
      projectName: 'Demo',
      firstName: 'John',
      lastName: 'Doe',
      projectId: '1001',
      joinProjectUrl:
        'https://work.topcoder-dev.com/projects/1001/accept/inv-100',
      declineProjectUrl:
        'https://work.topcoder-dev.com/projects/1001/decline/inv-100',
      initiatorFirstName: 'Jane',
      initiatorLastName: 'Smith',
    });
  });

  it('uses unknown-user invite template when isSSO=false', async () => {
    process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID =
      'known-template-id';
    process.env.SENDGRID_PROJECT_INVITATION_UNKNOWN_USER_TEMPLATE_ID =
      'unknown-template-id';

    await service.sendInviteEmail(
      '1001',
      {
        id: 321,
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
      data?: Record<string, unknown>;
    };

    expect(normalizedPayload.sendgrid_template_id).toBe('unknown-template-id');
    expect(normalizedPayload.data).toEqual({
      projectName: 'Demo',
      firstName: '',
      lastName: '',
      projectId: '1001',
      registerUrl:
        'https://accounts.topcoder-dev.com/?mode=signUp&regSource=tcBusiness&retUrl=https://work.topcoder-dev.com/projects/1001/accept/321',
      initiatorFirstName: 'Connect',
      initiatorLastName: 'User',
    });
  });

  it('falls back to legacy invite template when dedicated template is missing', async () => {
    process.env.SENDGRID_TEMPLATE_PROJECT_MEMBER_INVITED = 'legacy-template-id';

    await service.sendInviteEmail(
      '1001',
      {
        id: 'legacy-1',
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
        id: 'no-template',
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

  it('skips publish when invite id is missing', async () => {
    process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID =
      'known-template-id';

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

  it('uses topcoder.com links in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SENDGRID_PROJECT_INVITATION_KNOWN_USER_TEMPLATE_ID =
      'known-template-id';

    await service.sendInviteEmail(
      '1001',
      {
        id: 'prod-1',
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

    const [, payload] = eventBusServiceMock.publishProjectEvent.mock.calls[0];
    const normalizedPayload = payload as {
      data?: Record<string, unknown>;
    };

    expect(normalizedPayload.data).toMatchObject({
      joinProjectUrl: 'https://work.topcoder.com/projects/1001/accept/prod-1',
      declineProjectUrl:
        'https://work.topcoder.com/projects/1001/decline/prod-1',
    });
  });
});
