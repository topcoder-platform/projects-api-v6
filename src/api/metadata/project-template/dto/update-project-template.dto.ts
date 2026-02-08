import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectTemplateDto } from './create-project-template.dto';

export class UpdateProjectTemplateDto extends PartialType(
  CreateProjectTemplateDto,
) {}
