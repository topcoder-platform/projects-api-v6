import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectPostIndustryDto } from './create-project-post-industry.dto';

export class UpdateProjectPostIndustryDto extends PartialType(
  CreateProjectPostIndustryDto,
) {}
