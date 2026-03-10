import { PartialType } from '@nestjs/mapped-types';
import { CreatePhaseProductDto } from './create-phase-product.dto';

/**
 * Update payload for phase products/work items. This is a full `PartialType`
 * of `CreatePhaseProductDto`, so every create field is optional.
 */
export class UpdatePhaseProductDto extends PartialType(CreatePhaseProductDto) {}
