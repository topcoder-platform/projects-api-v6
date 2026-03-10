import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { JwtService } from '../modules/global/jwt.service';
import { M2MService } from '../modules/global/m2m.service';
import { ADMIN_ONLY_KEY } from './auth-metadata.constants';
import {
  ANY_AUTHENTICATED_KEY,
  ROLES_KEY,
  TokenRolesGuard,
} from './tokenRoles.guard';

describe('TokenRolesGuard', () => {
  let guard: TokenRolesGuard;

  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const jwtServiceMock = {
    validateToken: jest.fn(),
  };

  const m2mServiceMock = {
    validateMachineToken: jest.fn(),
    hasRequiredScopes: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TokenRolesGuard(
      reflectorMock as unknown as Reflector,
      jwtServiceMock as unknown as JwtService,
      m2mServiceMock as unknown as M2MService,
    );
  });

  const createExecutionContext = (request: Record<string, any>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  it('allows public routes without requiring token validation', async () => {
    reflectorMock.getAllAndOverride.mockReturnValueOnce(true);

    const result = await guard.canActivate(
      createExecutionContext({
        headers: {},
      }),
    );

    expect(result).toBe(true);
    expect(jwtServiceMock.validateToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Authorization header is missing', async () => {
    reflectorMock.getAllAndOverride.mockReturnValueOnce(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {},
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when Authorization header is invalid', async () => {
    reflectorMock.getAllAndOverride.mockReturnValueOnce(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {
            authorization: 'Token abc',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when bearer token is empty', async () => {
    reflectorMock.getAllAndOverride.mockReturnValueOnce(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {
            authorization: 'Bearer    ',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws ForbiddenException when route has no auth metadata', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === SCOPES_KEY) {
        return [];
      }
      if (key === ANY_AUTHENTICATED_KEY) {
        return false;
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: [],
      scopes: [],
      isMachine: false,
      tokenPayload: {
        sub: '123',
      },
    });

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {
            authorization: 'Bearer human-token',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows authenticated route when @AnyAuthenticated metadata is present', async () => {
    const request: Record<string, any> = {
      headers: {
        authorization: 'Bearer human-token',
      },
    };
    const user = {
      roles: [],
      scopes: [],
      isMachine: false,
      tokenPayload: {
        sub: '123',
      },
    };

    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === SCOPES_KEY) {
        return [];
      }
      if (key === ANY_AUTHENTICATED_KEY) {
        return true;
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue(user);

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual(user);
    expect(m2mServiceMock.validateMachineToken).not.toHaveBeenCalled();
  });

  it('allows human token when required role is present', async () => {
    const request: Record<string, any> = {
      headers: {
        authorization: 'Bearer human-token',
      },
    };
    const user = {
      roles: ['Connect Manager'],
      scopes: [],
      isMachine: false,
      tokenPayload: {
        sub: '123',
      },
    };

    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return ['connect manager'];
      }
      if (key === SCOPES_KEY) {
        return [];
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue(user);
    m2mServiceMock.validateMachineToken.mockReturnValue({
      isMachine: false,
      scopes: [],
    });

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual(user);
  });

  it('allows human token when required scope is present', async () => {
    const request: Record<string, any> = {
      headers: {
        authorization: 'Bearer human-token',
      },
    };

    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === SCOPES_KEY) {
        return ['read:projects'];
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: [],
      scopes: ['all:projects'],
      isMachine: false,
      tokenPayload: {
        sub: '123',
      },
    });
    m2mServiceMock.validateMachineToken.mockReturnValue({
      isMachine: false,
      scopes: [],
    });
    m2mServiceMock.hasRequiredScopes.mockReturnValue(true);

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(m2mServiceMock.hasRequiredScopes).toHaveBeenCalledWith(
      ['all:projects'],
      ['read:projects'],
    );
  });

  it('throws ForbiddenException when human token lacks required roles/scopes', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return ['administrator'];
      }
      if (key === SCOPES_KEY) {
        return ['write:projects'];
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: ['Topcoder User'],
      scopes: ['read:projects'],
      isMachine: false,
      tokenPayload: {
        sub: '123',
      },
    });
    m2mServiceMock.validateMachineToken.mockReturnValue({
      isMachine: false,
      scopes: [],
    });
    m2mServiceMock.hasRequiredScopes.mockReturnValue(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {
            authorization: 'Bearer human-token',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows machine token when required scope is present', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === SCOPES_KEY) {
        return ['read:projects'];
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: [],
      scopes: [],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
      },
    });
    m2mServiceMock.validateMachineToken.mockReturnValue({
      isMachine: true,
      scopes: ['all:projects'],
    });
    m2mServiceMock.hasRequiredScopes.mockReturnValue(true);

    const result = await guard.canActivate(
      createExecutionContext({
        headers: {
          authorization: 'Bearer machine-token',
        },
      }),
    );

    expect(result).toBe(true);
  });

  it('allows admin-only routes to defer authorization to AdminOnlyGuard', async () => {
    const request: Record<string, any> = {
      headers: {
        authorization: 'Bearer human-token',
      },
    };

    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === SCOPES_KEY) {
        return [];
      }
      if (key === ANY_AUTHENTICATED_KEY) {
        return false;
      }
      if (key === ADMIN_ONLY_KEY) {
        return true;
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: ['Topcoder User'],
      scopes: [],
      isMachine: false,
      tokenPayload: {
        sub: '123',
      },
    });

    const result = await guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({
        tokenPayload: {
          sub: '123',
        },
      }),
    );
    expect(m2mServiceMock.validateMachineToken).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException for machine token when endpoint only defines roles', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return ['administrator'];
      }
      if (key === SCOPES_KEY) {
        return [];
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: [],
      scopes: ['all:connect_project'],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
      },
    });
    m2mServiceMock.validateMachineToken.mockReturnValue({
      isMachine: true,
      scopes: ['all:connect_project'],
    });

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {
            authorization: 'Bearer machine-token',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws ForbiddenException for machine token with insufficient scopes', async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return false;
      }
      if (key === ROLES_KEY) {
        return [];
      }
      if (key === SCOPES_KEY) {
        return ['read:projects'];
      }
      return undefined;
    });

    jwtServiceMock.validateToken.mockResolvedValue({
      roles: [],
      scopes: [],
      isMachine: true,
      tokenPayload: {
        gty: 'client-credentials',
      },
    });
    m2mServiceMock.validateMachineToken.mockReturnValue({
      isMachine: true,
      scopes: ['read:project-members'],
    });
    m2mServiceMock.hasRequiredScopes.mockReturnValue(false);

    await expect(
      guard.canActivate(
        createExecutionContext({
          headers: {
            authorization: 'Bearer machine-token',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
