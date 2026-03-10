import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePhaseDto } from './create-phase.dto';

/**
 * Subset of `CreatePhaseDto` fields that are mutable through phase update
 * endpoints. `productTemplateId` and `members` are intentionally omitted; use
 * dedicated flows for template seeding and phase-member management.
 */
class UpdatablePhaseFieldsDto extends OmitType(CreatePhaseDto, [
  'productTemplateId',
  'members',
] as const) {}

/**
 * Partial update payload for:
 * `PATCH /projects/:projectId/phases/:phaseId` and
 * `PATCH /projects/:projectId/workstreams/:workStreamId/works/:id`.
 */
export class UpdatePhaseDto extends PartialType(UpdatablePhaseFieldsDto) {}
