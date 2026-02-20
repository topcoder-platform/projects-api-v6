import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectTemplateDto } from './create-project-template.dto';

/**
 * Request payload for partially updating a project template.
 *
 * @property name Optional template name.
 * @property key Optional template key.
 * @property category Optional category.
 * @property subCategory Optional sub-category.
 * @property metadata Optional metadata object.
 * @property icon Optional icon identifier.
 * @property question Optional prompt text.
 * @property info Optional informational text.
 * @property aliases Optional aliases list.
 * @property scope Optional legacy scope payload.
 * @property phases Optional legacy phases payload.
 * @property form Optional form reference override.
 * @property planConfig Optional plan config reference override.
 * @property priceConfig Optional price config reference override.
 * @property disabled Optional disabled flag.
 * @property hidden Optional hidden flag.
 */
export class UpdateProjectTemplateDto extends PartialType(
  CreateProjectTemplateDto,
) {}
