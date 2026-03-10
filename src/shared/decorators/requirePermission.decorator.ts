/**
 * Fine-grained permission decorator used by `PermissionGuard`.
 */
import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Permission as NamedPermission } from '../constants/permissions';
import { Permission } from '../interfaces/permission.interface';

/**
 * Metadata key used to store required permissions.
 */
export const PERMISSION_KEY = 'required_permissions';
/**
 * Swagger extension key used to expose permission requirements.
 */
export const SWAGGER_REQUIRED_PERMISSIONS_KEY = 'x-required-permissions';

/**
 * Accepted permission declaration type.
 *
 * Supports either:
 * - a named permission enum key, or
 * - an inline permission object.
 */
export type RequiredPermission = Permission | NamedPermission;

/**
 * Declares required permissions for a route.
 *
 * Nested arrays are flattened before metadata is written, then mirrored into a
 * Swagger extension for OpenAPI enrichment.
 *
 * @param permissions Named/inline permissions or nested arrays of them.
 */
export const RequirePermission = (
  ...permissions: (RequiredPermission | RequiredPermission[])[]
) => {
  const flattenedPermissions = permissions.flat();
  return applyDecorators(
    SetMetadata(PERMISSION_KEY, flattenedPermissions),
    ApiExtension(SWAGGER_REQUIRED_PERMISSIONS_KEY, flattenedPermissions),
  );
};
