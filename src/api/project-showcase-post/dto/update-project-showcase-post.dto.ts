import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectShowcasePostDto } from './create-project-showcase-post.dto';

export class UpdateProjectShowcasePostDto extends PartialType(
  CreateProjectShowcasePostDto,
) {}
