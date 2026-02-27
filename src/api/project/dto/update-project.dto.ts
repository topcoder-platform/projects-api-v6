import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';

/**
 * Request DTO for `PATCH /projects/:projectId`.
 *
 * Reuses `CreateProjectDto` and makes all fields optional via `PartialType`.
 */
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
