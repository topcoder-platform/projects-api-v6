import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkManagementPermissionDto } from './create-work-management-permission.dto';

/**
 * Request payload for partially updating a work management permission record.
 *
 * @property policy Optional policy override.
 * @property permission Optional permission payload override.
 * @property projectTemplateId Optional project template id override.
 */
export class UpdateWorkManagementPermissionDto extends PartialType(
  CreateWorkManagementPermissionDto,
) {}
