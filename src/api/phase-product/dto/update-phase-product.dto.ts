import { PartialType } from '@nestjs/mapped-types';
import { CreatePhaseProductDto } from './create-phase-product.dto';

export class UpdatePhaseProductDto extends PartialType(CreatePhaseProductDto) {}
