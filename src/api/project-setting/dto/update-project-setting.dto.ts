import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectSettingDto } from './create-project-setting.dto';

export class UpdateProjectSettingDto extends PartialType(
  CreateProjectSettingDto,
) {}
