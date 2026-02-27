import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectTypeDto } from './create-project-type.dto';

/**
 * Request payload for partially updating a project type.
 *
 * @property displayName Optional display name override.
 * @property icon Optional icon override.
 * @property question Optional prompt override.
 * @property info Optional informational text override.
 * @property aliases Optional aliases override.
 * @property metadata Optional metadata override.
 * @property disabled Optional disabled flag override.
 * @property hidden Optional hidden flag override.
 */
export class UpdateProjectTypeDto extends PartialType(CreateProjectTypeDto) {}
