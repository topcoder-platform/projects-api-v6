import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePhaseDto } from './create-phase.dto';

class UpdatablePhaseFieldsDto extends OmitType(CreatePhaseDto, [
  'productTemplateId',
  'members',
] as const) {}

export class UpdatePhaseDto extends PartialType(UpdatablePhaseFieldsDto) {}
