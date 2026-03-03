import { ProjectMemberRole } from '../enums/projectMemberRole.enum';
import { Scope } from '../enums/scopes.enum';
import { UserRole } from '../enums/userRole.enum';
import { Permission } from '../constants/permissions';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const m2mServiceMock = {
    hasRequiredScopes: jest.fn(
      (tokenScopes: string[], requiredScopes: string[]) =>
        requiredScopes.some((requiredScope) =>
          tokenScopes
            .map((scope) => scope.toLowerCase())
            .includes(requiredScope.toLowerCase()),
        ),
    ),
  };

  let service: PermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PermissionService(m2mServiceMock as any);
  });

  it('matches permission rule for topcoder role', () => {
    const hasMatch = service.matchPermissionRule(
      {
        topcoderRoles: [UserRole.CONNECT_ADMIN],
      },
      {
        roles: [UserRole.CONNECT_ADMIN],
        isMachine: false,
      },
    );

    expect(hasMatch).toBe(true);
  });

  it('matches permission rule for project member role', () => {
    const hasMatch = service.matchPermissionRule(
      {
        projectRoles: [ProjectMemberRole.MANAGER],
      },
      {
        userId: '123',
        roles: [UserRole.TOPCODER_USER],
        isMachine: false,
      },
      [
        {
          userId: '123',
          role: ProjectMemberRole.MANAGER,
        },
      ],
    );

    expect(hasMatch).toBe(true);
  });

  it('matches permission rule for m2m scope', () => {
    const hasMatch = service.matchPermissionRule(
      {
        scopes: [Scope.PROJECTS_READ],
      },
      {
        scopes: [Scope.PROJECTS_READ],
        isMachine: true,
      },
    );

    expect(hasMatch).toBe(true);
  });

  it('supports project role object rule with isPrimary flag', () => {
    const hasMatch = service.matchPermissionRule(
      {
        projectRoles: [
          {
            role: ProjectMemberRole.CUSTOMER,
            isPrimary: true,
          },
        ],
      },
      {
        userId: '456',
        isMachine: false,
      },
      [
        {
          userId: '456',
          role: ProjectMemberRole.CUSTOMER,
          isPrimary: true,
        },
      ],
    );

    expect(hasMatch).toBe(true);
  });

  it('supports topcoderRoles=true and projectRoles=true', () => {
    const hasTopcoderMatch = service.matchPermissionRule(
      {
        topcoderRoles: true,
      },
      {
        roles: [UserRole.TOPCODER_USER],
        isMachine: false,
      },
    );

    const hasProjectMemberMatch = service.matchPermissionRule(
      {
        projectRoles: true,
      },
      {
        userId: '789',
        isMachine: false,
      },
      [
        {
          userId: '789',
          role: ProjectMemberRole.OBSERVER,
        },
      ],
    );

    expect(hasTopcoderMatch).toBe(true);
    expect(hasProjectMemberMatch).toBe(true);
  });

  it('handles allowRule and denyRule correctly', () => {
    const denied = service.hasPermission(
      {
        allowRule: {
          topcoderRoles: [UserRole.MANAGER],
        },
        denyRule: {
          topcoderRoles: [UserRole.MANAGER],
        },
      },
      {
        roles: [UserRole.MANAGER],
        isMachine: false,
      },
    );

    const allowed = service.hasPermission(
      {
        allowRule: {
          topcoderRoles: [UserRole.MANAGER],
        },
        denyRule: {
          topcoderRoles: [UserRole.COPILOT],
        },
      },
      {
        roles: [UserRole.MANAGER],
        isMachine: false,
      },
    );

    expect(denied).toBe(false);
    expect(allowed).toBe(true);
  });

  it('returns default project role based on topcoder role mapping', () => {
    const role = service.getDefaultProjectRole({
      roles: [UserRole.MANAGER],
      isMachine: false,
    });

    expect(role).toBe(ProjectMemberRole.MANAGER);
  });

  it('allows available billing accounts permission for copilot project member', () => {
    const allowed = service.hasNamedPermission(
      Permission.READ_AVL_PROJECT_BILLING_ACCOUNTS,
      {
        userId: '123',
        roles: [UserRole.TOPCODER_USER],
        isMachine: false,
      },
      [
        {
          userId: '123',
          role: ProjectMemberRole.COPILOT,
        },
      ],
    );

    expect(allowed).toBe(true);
  });

  it('allows billing account details permission for matching m2m scope', () => {
    const allowed = service.hasNamedPermission(
      Permission.READ_PROJECT_BILLING_ACCOUNT_DETAILS,
      {
        scopes: [Scope.PROJECTS_READ_PROJECT_BILLING_ACCOUNT_DETAILS],
        isMachine: true,
      },
    );

    expect(allowed).toBe(true);
  });

  it('allows viewing project for machine token with project read scope', () => {
    const allowed = service.hasNamedPermission(Permission.VIEW_PROJECT, {
      scopes: [Scope.PROJECTS_READ],
      isMachine: true,
    });

    expect(allowed).toBe(true);
  });

  it('allows reading project members for machine token with project-member read scope', () => {
    const allowed = service.hasNamedPermission(Permission.READ_PROJECT_MEMBER, {
      scopes: [Scope.PROJECT_MEMBERS_READ],
      isMachine: true,
    });

    expect(allowed).toBe(true);
  });

  it('allows viewing project for pending email invite that matches user email', () => {
    const allowed = service.hasNamedPermission(
      Permission.VIEW_PROJECT,
      {
        userId: '88770025',
        email: 'jmgasper+devtest140@gmail.com',
        isMachine: false,
      },
      [],
      [
        {
          email: 'JMGasper+devtest140@gmail.com',
          status: 'pending',
        },
      ],
    );

    expect(allowed).toBe(true);
  });

  it('allows viewing project for pending email invite using namespaced email claim', () => {
    const allowed = service.hasNamedPermission(
      Permission.VIEW_PROJECT,
      {
        userId: '88770025',
        isMachine: false,
        tokenPayload: {
          'https://topcoder-dev.com/email': 'jmgasper+devtest140@gmail.com',
        },
      },
      [],
      [
        {
          email: 'jmgasper+devtest140@gmail.com',
          status: 'pending',
        },
      ],
    );

    expect(allowed).toBe(true);
  });

  it('allows editing project for machine token with project write scope', () => {
    const allowed = service.hasNamedPermission(Permission.EDIT_PROJECT, {
      scopes: [Scope.PROJECTS_WRITE],
      isMachine: true,
    });

    expect(allowed).toBe(true);
  });

  it.each([UserRole.TALENT_MANAGER, UserRole.TOPCODER_TALENT_MANAGER])(
    'allows editing project for %s Topcoder role without project membership',
    (role) => {
      const allowed = service.hasNamedPermission(Permission.EDIT_PROJECT, {
        userId: '555',
        roles: [role],
        isMachine: false,
      });

      expect(allowed).toBe(true);
    },
  );

  it('marks billing account permissions as requiring project member context', () => {
    expect(
      service.isNamedPermissionRequireProjectMembers(
        Permission.READ_AVL_PROJECT_BILLING_ACCOUNTS,
      ),
    ).toBe(true);
    expect(
      service.isNamedPermissionRequireProjectMembers(
        Permission.READ_PROJECT_BILLING_ACCOUNT_DETAILS,
      ),
    ).toBe(true);
  });
});
