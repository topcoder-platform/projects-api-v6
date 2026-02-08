import { SetMetadata } from '@nestjs/common';
import { Permission as NamedPermission } from '../constants/permissions';
import { Permission } from '../interfaces/permission.interface';

export const PERMISSION_KEY = 'required_permissions';

export type RequiredPermission = Permission | NamedPermission;

export const RequirePermission = (
  ...permissions: (RequiredPermission | RequiredPermission[])[]
) => SetMetadata(PERMISSION_KEY, permissions.flat());
