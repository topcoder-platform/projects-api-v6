import { PartialType } from '@nestjs/mapped-types';
import { CreateOrgConfigDto } from './create-org-config.dto';

export class UpdateOrgConfigDto extends PartialType(CreateOrgConfigDto) {}
