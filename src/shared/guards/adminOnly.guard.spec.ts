import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Scope } from '../enums/scopes.enum';
import { UserRole } from '../enums/userRole.enum';
import { M2MService } from '../modules/global/m2m.service';
import { PermissionService } from '../services/permission.service';
import { AdminOnlyGuard } from './adminOnly.guard';

describe('AdminOnlyGuard', () => {
  let guard: AdminOnlyGuard;

  const permissionServiceMock = {
    hasIntersection: jest.fn(),
  };

  const m2mServiceMock = {
    hasRequiredScopes: jest.fn(),
  };

  const createExecutionContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new AdminOnlyGuard(
      permissionServiceMock as unknown as PermissionService,
      m2mServiceMock as unknown as M2MService,
    );
  });

  it('throws UnauthorizedException when user is missing', () => {
    expect(() =>
      guard.canActivate(
        createExecutionContext({
          user: undefined,
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('allows access when user has an admin role', () => {
    permissionServiceMock.hasIntersection.mockReturnValue(true);

    const result = guard.canActivate(
      createExecutionContext({
        user: {
          roles: [UserRole.TOPCODER_ADMIN],
          scopes: [],
        },
      }),
    );

    expect(result).toBe(true);
    expect(m2mServiceMock.hasRequiredScopes).not.toHaveBeenCalled();
  });

  it('allows access when user has admin scope even without admin role', () => {
    permissionServiceMock.hasIntersection.mockReturnValue(false);
    m2mServiceMock.hasRequiredScopes.mockReturnValue(true);

    const result = guard.canActivate(
      createExecutionContext({
        user: {
          roles: [UserRole.TOPCODER_USER],
          scopes: [Scope.CONNECT_PROJECT_ADMIN],
        },
      }),
    );

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when user lacks admin role and scope', () => {
    permissionServiceMock.hasIntersection.mockReturnValue(false);
    m2mServiceMock.hasRequiredScopes.mockReturnValue(false);

    expect(() =>
      guard.canActivate(
        createExecutionContext({
          user: {
            roles: [UserRole.TOPCODER_USER],
            scopes: [],
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
