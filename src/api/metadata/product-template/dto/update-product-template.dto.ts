import { PartialType } from '@nestjs/mapped-types';
import { CreateProductTemplateDto } from './create-product-template.dto';

/**
 * Request payload for partially updating a product template.
 *
 * @property name Optional template name.
 * @property productKey Optional product key.
 * @property category Optional category.
 * @property subCategory Optional sub-category.
 * @property icon Optional icon identifier.
 * @property brief Optional brief description.
 * @property details Optional details description.
 * @property aliases Optional aliases list.
 * @property template Optional legacy template payload.
 * @property form Optional form reference override.
 * @property disabled Optional disabled flag.
 * @property hidden Optional hidden flag.
 * @property isAddOn Optional add-on flag.
 */
export class UpdateProductTemplateDto extends PartialType(
  CreateProductTemplateDto,
) {}
