import { PartialType } from '@nestjs/mapped-types';
import { CreateOrgConfigDto } from './create-org-config.dto';

/**
 * Request payload for partially updating an org config entry.
 *
 * @property orgId Optional organization id override.
 * @property configName Optional config key override.
 * @property configValue Optional config value override.
 */
export class UpdateOrgConfigDto extends PartialType(CreateOrgConfigDto) {}
