/**
 * Swagger/OpenAPI auth documentation enrichers.
 *
 * `enrichSwaggerAuthDocumentation` is applied in `main.ts` to translate custom
 * auth extension metadata into human-readable authorization summaries while
 * ensuring `401` and `403` responses are declared.
 */
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
import {
  SWAGGER_ANY_AUTHENTICATED_KEY,
  SWAGGER_REQUIRED_ROLES_KEY,
} from '../guards/tokenRoles.guard';
import { UserRole } from '../enums/userRole.enum';

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

const ALL_KNOWN_USER_ROLES = new Set(
  Object.values(UserRole).map((role) => role.trim().toLowerCase()),
);

/**
 * Safely coerces unknown values to a trimmed `string[]`.
 */
function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Parses required-permission extension values to display-friendly strings.
 *
 * Inline permission objects are JSON-stringified.
 */
function parsePermissionArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => stringifyPermission(entry as RequiredPermission))
    .filter((entry) => entry.length > 0);
}

/**
 * Stringifies a permission key or inline permission object.
 */
function stringifyPermission(permission: RequiredPermission): string {
  if (typeof permission === 'string') {
    return permission;
  }

  return JSON.stringify(permission);
}

/**
 * Appends an `Authorization:` section to an operation description.
 *
 * Idempotent: if an authorization section already exists, description is left
 * unchanged.
 */
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

/**
 * Ensures standard auth error response stubs exist on an operation.
 */
function ensureErrorResponses(operation: SwaggerOperation): void {
  operation.responses = operation.responses || {};

  if (!operation.responses['401']) {
    operation.responses['401'] = { description: 'Unauthorized' };
  }

  if (!operation.responses['403']) {
    operation.responses['403'] = { description: 'Forbidden' };
  }
}

/**
 * Detects whether Swagger role metadata effectively means "any known user role".
 *
 * Many endpoints use this broad role gate as a coarse auth pass-through and
 * rely on policy permissions for actual access decisions.
 */
function isAllKnownUserRoles(roles: string[]): boolean {
  if (roles.length === 0) {
    return false;
  }

  const normalizedRoles = new Set(
    roles.map((role) => role.trim().toLowerCase()).filter(Boolean),
  );

  if (normalizedRoles.size !== ALL_KNOWN_USER_ROLES.size) {
    return false;
  }

  for (const knownRole of ALL_KNOWN_USER_ROLES) {
    if (!normalizedRoles.has(knownRole)) {
      return false;
    }
  }

  return true;
}

/**
 * Builds human-readable authorization lines from custom Swagger extensions.
 */
function getAuthorizationLines(operation: SwaggerOperation): string[] {
  const roles = parseStringArray(operation[SWAGGER_REQUIRED_ROLES_KEY]);
  const scopes = parseStringArray(operation[SWAGGER_REQUIRED_SCOPES_KEY]);
  const isAnyAuthenticated = Boolean(operation[SWAGGER_ANY_AUTHENTICATED_KEY]);
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
  const hasAllKnownUserRoles = isAllKnownUserRoles(roles);

  if (isAnyAuthenticated) {
    authorizationLines.push('Any authenticated token is allowed.');
  }

  if (roles.length > 0 && !(hasAllKnownUserRoles && permissions.length > 0)) {
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

/**
 * Enriches OpenAPI operation descriptions with authorization summaries.
 *
 * Iterates each path/method, inspects custom auth metadata extensions, appends
 * authorization details to operation descriptions, and ensures `401`/`403`
 * response declarations.
 *
 * @returns The same mutated OpenAPI document instance.
 */
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
