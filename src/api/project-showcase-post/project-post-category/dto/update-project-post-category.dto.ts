import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectPostCategoryDto } from './create-project-post-category.dto';

export class UpdateProjectPostCategoryDto extends PartialType(
  CreateProjectPostCategoryDto,
) {}
