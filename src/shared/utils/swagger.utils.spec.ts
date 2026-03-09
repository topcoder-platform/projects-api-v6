import { OpenAPIObject } from '@nestjs/swagger';
import { Permission } from '../constants/permissions';
import { SWAGGER_REQUIRED_PERMISSIONS_KEY } from '../decorators/requirePermission.decorator';
import { SWAGGER_REQUIRED_SCOPES_KEY } from '../decorators/scopes.decorator';
import { Scope } from '../enums/scopes.enum';
import { UserRole } from '../enums/userRole.enum';
import { SWAGGER_REQUIRED_ROLES_KEY } from '../guards/tokenRoles.guard';
import { enrichSwaggerAuthDocumentation } from './swagger.utils';

describe('enrichSwaggerAuthDocumentation', () => {
  function createDocument(operation: Record<string, unknown>): OpenAPIObject {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Swagger auth docs test',
        version: '1.0.0',
      },
      paths: {
        '/test': {
          get: {
            responses: {},
            ...operation,
          },
        },
      },
    } as unknown as OpenAPIObject;
  }

  it('renders any-authenticated policy guidance instead of raw permission keys', () => {
    const document = createDocument({
      description: 'Create a project.',
      [SWAGGER_REQUIRED_ROLES_KEY]: Object.values(UserRole),
      [SWAGGER_REQUIRED_SCOPES_KEY]: [
        Scope.PROJECTS_WRITE,
        Scope.PROJECTS_ALL,
        Scope.CONNECT_PROJECT_ADMIN,
      ],
      [SWAGGER_REQUIRED_PERMISSIONS_KEY]: [Permission.CREATE_PROJECT],
    });

    enrichSwaggerAuthDocumentation(document);

    const description = document.paths['/test'].get?.description;

    expect(description).toContain('Authorization:');
    expect(description).toContain(
      'Allowed token scopes (any): write:projects, all:projects, all:connect_project',
    );
    expect(description).toContain('Policy allows any authenticated caller.');
    expect(description).not.toContain('Required policy permissions');
  });

  it('documents project-member and invite-based access for project view routes', () => {
    const document = createDocument({
      description: 'Get a project.',
      [SWAGGER_REQUIRED_ROLES_KEY]: Object.values(UserRole),
      [SWAGGER_REQUIRED_SCOPES_KEY]: [
        Scope.PROJECTS_READ,
        Scope.PROJECTS_WRITE,
        Scope.PROJECTS_ALL,
      ],
      [SWAGGER_REQUIRED_PERMISSIONS_KEY]: [Permission.VIEW_PROJECT],
    });

    enrichSwaggerAuthDocumentation(document);

    const description = document.paths['/test'].get?.description;

    expect(description).toContain(
      'Policy allows user roles (any): Connect Admin, administrator, tgadmin, Connect Manager, topcoder_manager',
    );
    expect(description).toContain('Policy allows any current project member.');
    expect(description).toContain('Policy allows pending invite recipients.');
    expect(description).toContain(
      'Policy allows token scopes (any): all:connect_project, all:projects, read:projects, write:projects',
    );
  });

  it('documents permission-specific machine scopes when policy narrows route access', () => {
    const document = createDocument({
      description: 'Get project billing account details.',
      [SWAGGER_REQUIRED_ROLES_KEY]: Object.values(UserRole),
      [SWAGGER_REQUIRED_SCOPES_KEY]: [
        Scope.PROJECTS_READ,
        Scope.PROJECTS_WRITE,
        Scope.PROJECTS_ALL,
      ],
      [SWAGGER_REQUIRED_PERMISSIONS_KEY]: [
        Permission.READ_PROJECT_BILLING_ACCOUNT_DETAILS,
      ],
    });

    enrichSwaggerAuthDocumentation(document);

    const description = document.paths['/test'].get?.description;

    expect(description).toContain(
      'Policy allows user roles (any): Connect Admin, administrator, tgadmin, Project Manager, Task Manager, Topcoder Task Manager, Talent Manager, Topcoder Talent Manager',
    );
    expect(description).toContain(
      'Policy allows project member roles (any): manager, account_manager, account_executive, project_manager, program_manager, solution_architect, copilot',
    );
    expect(description).toContain(
      'Policy allows token scopes (any): read:project-billing-account-details',
    );
  });
});
