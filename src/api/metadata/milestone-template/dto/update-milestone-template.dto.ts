import { PartialType } from '@nestjs/mapped-types';
import { CreateMilestoneTemplateDto } from './create-milestone-template.dto';

/**
 * Request payload for partially updating a milestone template.
 *
 * @property name Optional milestone name override.
 * @property description Optional description override.
 * @property duration Optional duration override.
 * @property type Optional type override.
 * @property order Optional order override.
 * @property plannedText Optional planned text override.
 * @property activeText Optional active text override.
 * @property completedText Optional completed text override.
 * @property blockedText Optional blocked text override.
 * @property reference Optional reference override.
 * @property referenceId Optional reference id override.
 * @property metadata Optional metadata override.
 * @property hidden Optional hidden flag override.
 */
export class UpdateMilestoneTemplateDto extends PartialType(
  CreateMilestoneTemplateDto,
) {}
