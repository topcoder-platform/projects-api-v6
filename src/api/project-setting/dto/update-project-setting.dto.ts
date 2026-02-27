import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectSettingDto } from './create-project-setting.dto';

/**
 * DTO for updating project settings.
 *
 * Extends `PartialType(CreateProjectSettingDto)`, making all create fields
 * optional for patch semantics.
 */
export class UpdateProjectSettingDto extends PartialType(
  CreateProjectSettingDto,
) {}
