import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkManagementPermissionDto } from './create-work-management-permission.dto';

export class UpdateWorkManagementPermissionDto extends PartialType(
  CreateWorkManagementPermissionDto,
) {}
