import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { getAuditUserIdNumber } from '../utils/metadata-utils';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { ProductCategoryResponseDto } from './dto/product-category-response.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategoryService } from './product-category.service';

@ApiTags('Metadata - Product Categories')
@ApiBearerAuth()
@Controller('/projects/metadata/productCategories')
/**
 * REST controller for product category metadata.
 */
export class ProductCategoryController {
  constructor(
    private readonly productCategoryService: ProductCategoryService,
  ) {}

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get()
  @ApiOperation({ summary: 'List product categories' })
  @ApiResponse({ status: 200, type: [ProductCategoryResponseDto] })
  /**
   * Lists product categories.
   */
  async list(): Promise<ProductCategoryResponseDto[]> {
    return this.productCategoryService.findAll();
  }

  // TODO (SECURITY): This GET endpoint has no auth guard and is not marked @Public(). Clarify intent.
  @Get(':key')
  @ApiOperation({ summary: 'Get product category by key' })
  @ApiParam({ name: 'key', description: 'Product category key' })
  @ApiResponse({ status: 200, type: ProductCategoryResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Gets one product category by key.
   */
  async getOne(@Param('key') key: string): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.findByKey(key);
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create product category' })
  @ApiResponse({ status: 201, type: ProductCategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  /**
   * Creates a product category.
   */
  async create(
    @Body() dto: CreateProductCategoryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.create(dto, getAuditUserIdNumber(user));
  }

  @Patch(':key')
  @AdminOnly()
  @ApiOperation({ summary: 'Update product category' })
  @ApiParam({ name: 'key', description: 'Product category key' })
  @ApiResponse({ status: 200, type: ProductCategoryResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Updates a product category.
   */
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateProductCategoryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductCategoryResponseDto> {
    return this.productCategoryService.update(
      key,
      dto,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':key')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete product category (soft delete)' })
  @ApiParam({ name: 'key', description: 'Product category key' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Soft deletes a product category.
   */
  async delete(
    @Param('key') key: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.productCategoryService.delete(key, getAuditUserIdNumber(user));
  }
}
