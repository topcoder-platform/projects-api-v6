import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { M2MService } from 'src/shared/modules/global/m2m.service';
import { MemberService } from './member.service';

jest.mock('src/shared/config/service-endpoints.config', () => ({
  SERVICE_ENDPOINTS: {
    identityApiUrl: 'https://identity.test',
    memberApiUrl: 'https://member.test',
  },
}));

describe('MemberService', () => {
  const httpServiceMock = {
    get: jest.fn(),
  };

  const m2mServiceMock = {
    getM2MToken: jest.fn().mockResolvedValue('m2m-token'),
  };

  let service: MemberService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new MemberService(
      httpServiceMock as unknown as HttpService,
      m2mServiceMock as unknown as M2MService,
    );
  });

  it('returns subjects from successful role lookups when one role detail request fails', async () => {
    httpServiceMock.get.mockImplementation(
      (url: string, options: { params?: { filter?: string } }) => {
        if (
          url === 'https://identity.test/roles' &&
          options.params?.filter === 'roleName=copilot'
        ) {
          return of({
            data: [
              { id: '101', roleName: 'copilot' },
              { id: '102', roleName: 'copilot' },
            ],
          });
        }

        if (url === 'https://identity.test/roles/101') {
          return of({
            data: {
              subjects: [
                {
                  subjectID: 4001,
                  handle: 'copilot-one',
                  email: 'Copilot.One@Topcoder.com',
                },
              ],
            },
          });
        }

        if (url === 'https://identity.test/roles/102') {
          return throwError(() => new Error('role lookup failed'));
        }

        return of({ data: {} });
      },
    );

    const result = await service.getRoleSubjects('copilot');

    expect(result).toEqual([
      {
        userId: 4001,
        handle: 'copilot-one',
        email: 'copilot.one@topcoder.com',
      },
    ]);
    expect(m2mServiceMock.getM2MToken).toHaveBeenCalledTimes(1);
    expect(httpServiceMock.get).toHaveBeenCalledWith(
      'https://identity.test/roles/101',
      expect.objectContaining({
        params: expect.objectContaining({
          selector: 'subjects',
          perPage: 200,
        }),
      }),
    );
  });

  it('returns empty list when role list lookup fails', async () => {
    httpServiceMock.get.mockImplementation((url: string) => {
      if (url === 'https://identity.test/roles') {
        return throwError(() => new Error('identity unavailable'));
      }

      return of({ data: {} });
    });

    const result = await service.getRoleSubjects('Project Manager');

    expect(result).toEqual([]);
    expect(m2mServiceMock.getM2MToken).toHaveBeenCalledTimes(1);
  });
});
