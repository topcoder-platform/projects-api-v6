import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { IdentityService } from './identity.service';

jest.mock('src/shared/config/service-endpoints.config', () => ({
  SERVICE_ENDPOINTS: {
    identityApiUrl: 'https://identity.test',
    memberApiUrl: 'https://member.test',
  },
}));

describe('IdentityService', () => {
  const httpServiceMock = {
    get: jest.fn(),
  };

  const m2mServiceMock = {
    getM2MToken: jest.fn().mockResolvedValue('m2m-token'),
  };

  let service: IdentityService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new IdentityService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
  });

  it('returns users from Identity API when lookups succeed', async () => {
    httpServiceMock.get.mockImplementation(
      (url: string, options: { params?: { filter?: string } }) => {
        if (
          url === 'https://identity.test/users' &&
          options.params?.filter === 'email=member1@topcoder.com'
        ) {
          return of({
            data: [
              {
                id: '1001',
                handle: 'member1',
                email: 'member1@topcoder.com',
              },
            ],
          });
        }

        if (
          url === 'https://identity.test/users' &&
          options.params?.filter === 'email=member2@topcoder.com'
        ) {
          return of({
            data: [
              {
                id: '1002',
                handle: 'member2',
                email: 'member2@topcoder.com',
              },
            ],
          });
        }

        return of({ data: [] });
      },
    );

    const result = await service.lookupMultipleUserEmails([
      'member1@topcoder.com',
      'member2@topcoder.com',
    ]);

    expect(result).toEqual([
      {
        id: '1001',
        handle: 'member1',
        email: 'member1@topcoder.com',
      },
      {
        id: '1002',
        handle: 'member2',
        email: 'member2@topcoder.com',
      },
    ]);

    expect(m2mServiceMock.getM2MToken).toHaveBeenCalledTimes(1);
  });

  it('falls back to Member API for unresolved emails', async () => {
    httpServiceMock.get.mockImplementation(
      (url: string, options: { params?: { email?: string } }) => {
        if (url === 'https://identity.test/users') {
          return throwError(() => new Error('identity lookup failed'));
        }

        if (
          url === 'https://member.test' &&
          options.params?.email === 'existing@topcoder.com'
        ) {
          return of({
            data: [
              {
                userId: 2001,
                handle: 'existing',
                email: 'existing@topcoder.com',
              },
            ],
          });
        }

        if (
          url === 'https://member.test' &&
          options.params?.email === 'newuser@topcoder.com'
        ) {
          return of({ data: [] });
        }

        return of({ data: [] });
      },
    );

    const result = await service.lookupMultipleUserEmails([
      'existing@topcoder.com',
      'newuser@topcoder.com',
    ]);

    expect(result).toEqual([
      {
        id: '2001',
        handle: 'existing',
        email: 'existing@topcoder.com',
      },
    ]);

    expect(m2mServiceMock.getM2MToken).toHaveBeenCalledTimes(1);
  });
});
