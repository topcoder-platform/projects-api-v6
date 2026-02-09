import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import { Permission as NamedPermission } from '../constants/permissions';
import { Permission } from '../interfaces/permission.interface';

export const PERMISSION_KEY = 'required_permissions';
export const SWAGGER_REQUIRED_PERMISSIONS_KEY = 'x-required-permissions';

export type RequiredPermission = Permission | NamedPermission;

export const RequirePermission = (
  ...permissions: (RequiredPermission | RequiredPermission[])[]
) => {
  const flattenedPermissions = permissions.flat();
  return applyDecorators(
    SetMetadata(PERMISSION_KEY, flattenedPermissions),
    ApiExtension(SWAGGER_REQUIRED_PERMISSIONS_KEY, flattenedPermissions),
  );
};
