import { LoggerService } from './logger.service';

type LoggerServicePrivate = {
  serializeMessage: (message: unknown) => string;
};

describe('LoggerService', () => {
  const serializeMessage = (
    service: LoggerService,
    message: unknown,
  ): string => {
    return (service as unknown as LoggerServicePrivate).serializeMessage(
      message,
    );
  };

  it('redacts secret-like values embedded in string messages', () => {
    const service = new LoggerService('LoggerServiceSpec');

    expect(
      serializeMessage(
        service,
        'AUTH_SECRET=super-secret Authorization: Bearer abc.def.ghi password:topsecret',
      ),
    ).toBe(
      'AUTH_SECRET=[REDACTED] Authorization: [REDACTED] password:[REDACTED]',
    );
  });

  it('omits object payload contents from log output', () => {
    const service = new LoggerService('LoggerServiceSpec');

    expect(
      serializeMessage(service, {
        AUTH0_CLIENT_SECRET: 'super-secret',
        harmless: 'value',
      }),
    ).toBe('[redacted object payload]');
  });

  it('omits array payload contents from log output', () => {
    const service = new LoggerService('LoggerServiceSpec');

    expect(serializeMessage(service, ['secret-token', 'another-value'])).toBe(
      '[redacted array payload]',
    );
  });

  it('sanitizes error messages before logging them', () => {
    const service = new LoggerService('LoggerServiceSpec');

    expect(
      serializeMessage(service, new Error('client_secret=my-secret-value')),
    ).toBe('Error: client_secret=[REDACTED]');
  });
});
