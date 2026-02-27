import { PartialType } from '@nestjs/mapped-types';
import { CreateProductCategoryDto } from './create-product-category.dto';

/**
 * Request payload for partially updating a product category.
 *
 * @property displayName Optional display name override.
 * @property icon Optional icon override.
 * @property question Optional prompt override.
 * @property info Optional informational text override.
 * @property aliases Optional aliases override.
 * @property disabled Optional disabled flag override.
 * @property hidden Optional hidden flag override.
 */
export class UpdateProductCategoryDto extends PartialType(
  CreateProductCategoryDto,
) {}
