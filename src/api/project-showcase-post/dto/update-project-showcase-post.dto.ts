import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectShowcasePostDto } from './create-project-showcase-post.dto';

/** Patches supplied showcase fields while preserving omitted fields on legacy posts. */
export class UpdateProjectShowcasePostDto extends PartialType(
  CreateProjectShowcasePostDto,
  { skipNullProperties: false },
) {}
