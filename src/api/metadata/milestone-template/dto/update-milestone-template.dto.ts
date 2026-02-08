import { PartialType } from '@nestjs/mapped-types';
import { CreateMilestoneTemplateDto } from './create-milestone-template.dto';

export class UpdateMilestoneTemplateDto extends PartialType(
  CreateMilestoneTemplateDto,
) {}
