import { OpenAPIObject } from '@nestjs/swagger';
import {
  SWAGGER_REQUIRED_PERMISSIONS_KEY,
  RequiredPermission,
} from '../decorators/requirePermission.decorator';
import { SWAGGER_REQUIRED_SCOPES_KEY } from '../decorators/scopes.decorator';
import {
  SWAGGER_ADMIN_ALLOWED_ROLES_KEY,
  SWAGGER_ADMIN_ALLOWED_SCOPES_KEY,
  SWAGGER_ADMIN_ONLY_KEY,
} from '../guards/adminOnly.guard';
import { SWAGGER_REQUIRED_ROLES_KEY } from '../guards/tokenRoles.guard';

type SwaggerOperation = {
  description?: string;
  responses?: Record<string, unknown>;
  [key: string]: unknown;
};

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

function parsePermissionArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => stringifyPermission(entry as RequiredPermission))
    .filter((entry) => entry.length > 0);
}

function stringifyPermission(permission: RequiredPermission): string {
  if (typeof permission === 'string') {
    return permission;
  }

  return JSON.stringify(permission);
}

function addAuthSection(
  description: string | undefined,
  authorizationLines: string[],
): string {
  if (authorizationLines.length === 0) {
    return description || '';
  }

  const authSection = [
    'Authorization:',
    ...authorizationLines.map((line) => `- ${line}`),
  ].join('\n');

  if (!description || description.trim().length === 0) {
    return authSection;
  }

  if (description.includes('Authorization:')) {
    return description;
  }

  return `${description}\n\n${authSection}`;
}

function ensureErrorResponses(operation: SwaggerOperation): void {
  operation.responses = operation.responses || {};

  if (!operation.responses['401']) {
    operation.responses['401'] = { description: 'Unauthorized' };
  }

  if (!operation.responses['403']) {
    operation.responses['403'] = { description: 'Forbidden' };
  }
}

function getAuthorizationLines(operation: SwaggerOperation): string[] {
  const roles = parseStringArray(operation[SWAGGER_REQUIRED_ROLES_KEY]);
  const scopes = parseStringArray(operation[SWAGGER_REQUIRED_SCOPES_KEY]);
  const permissions = parsePermissionArray(
    operation[SWAGGER_REQUIRED_PERMISSIONS_KEY],
  );
  const isAdminOnly = Boolean(operation[SWAGGER_ADMIN_ONLY_KEY]);
  const adminRoles = parseStringArray(
    operation[SWAGGER_ADMIN_ALLOWED_ROLES_KEY],
  );
  const adminScopes = parseStringArray(
    operation[SWAGGER_ADMIN_ALLOWED_SCOPES_KEY],
  );

  const authorizationLines: string[] = [];

  if (roles.length > 0) {
    authorizationLines.push(`Allowed user roles (any): ${roles.join(', ')}`);
  }

  if (scopes.length > 0) {
    authorizationLines.push(`Allowed token scopes (any): ${scopes.join(', ')}`);
  }

  if (permissions.length > 0) {
    authorizationLines.push(
      `Required policy permissions (any): ${permissions.join(', ')}`,
    );
  }

  if (isAdminOnly) {
    const details = [
      adminRoles.length > 0 ? `roles (${adminRoles.join(', ')})` : undefined,
      adminScopes.length > 0 ? `scopes (${adminScopes.join(', ')})` : undefined,
    ]
      .filter((entry): entry is string => Boolean(entry))
      .join(' or ');

    if (details.length > 0) {
      authorizationLines.push(`Admin-only endpoint: requires ${details}.`);
    } else {
      authorizationLines.push('Admin-only endpoint.');
    }
  }

  return authorizationLines;
}

export function enrichSwaggerAuthDocumentation(
  document: OpenAPIObject,
): OpenAPIObject {
  for (const path of Object.values(document.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = path[method] as SwaggerOperation | undefined;
      if (!operation) {
        continue;
      }

      const authorizationLines = getAuthorizationLines(operation);
      if (authorizationLines.length === 0) {
        continue;
      }

      operation.description = addAuthSection(
        operation.description,
        authorizationLines,
      );
      ensureErrorResponses(operation);
    }
  }

  return document;
}
