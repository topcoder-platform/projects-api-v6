import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { Public } from 'src/shared/decorators/public.decorator';
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import {
  getAuditUserIdBigInt,
  parseOptionalBooleanQuery,
} from '../utils/metadata-utils';
import { CreateProductTemplateDto } from './dto/create-product-template.dto';
import { ProductTemplateResponseDto } from './dto/product-template-response.dto';
import { UpdateProductTemplateDto } from './dto/update-product-template.dto';
import { UpgradeProductTemplateDto } from './dto/upgrade-product-template.dto';
import { ProductTemplateService } from './product-template.service';

@ApiTags('Metadata - Product Templates')
@ApiBearerAuth()
@Controller('/projects/metadata/productTemplates')
/**
 * REST controller for product template metadata.
 *
 * Read endpoints are public (`@Public()`); write endpoints require
 * `@AdminOnly`.
 */
export class ProductTemplateController {
  constructor(
    private readonly productTemplateService: ProductTemplateService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List product templates',
  })
  @ApiQuery({
    name: 'includeDisabled',
    required: false,
    type: Boolean,
  })
  @ApiResponse({ status: 200, type: [ProductTemplateResponseDto] })
  /**
   * Lists product templates.
   */
  async list(
    @Query('includeDisabled') includeDisabled?: string,
  ): Promise<ProductTemplateResponseDto[]> {
    return this.productTemplateService.findAll(
      parseOptionalBooleanQuery(includeDisabled) || false,
    );
  }

  @Public()
  @Get(':templateId')
  @ApiOperation({ summary: 'Get product template by id' })
  @ApiParam({ name: 'templateId', description: 'Product template id' })
  @ApiResponse({ status: 200, type: ProductTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Gets one product template by id.
   */
  async getOne(
    @Param('templateId') templateId: string,
  ): Promise<ProductTemplateResponseDto> {
    return this.productTemplateService.findOne(
      this.productTemplateService.parseTemplateId(templateId),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create product template' })
  @ApiResponse({ status: 201, type: ProductTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  /**
   * Creates a product template.
   */
  async create(
    @Body() dto: CreateProductTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductTemplateResponseDto> {
    return this.productTemplateService.create(dto, getAuditUserIdBigInt(user));
  }

  @Patch(':templateId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update product template' })
  @ApiParam({ name: 'templateId', description: 'Product template id' })
  @ApiResponse({ status: 200, type: ProductTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Updates a product template by id.
   */
  async update(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateProductTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductTemplateResponseDto> {
    return this.productTemplateService.update(
      this.productTemplateService.parseTemplateId(templateId),
      dto,
      getAuditUserIdBigInt(user),
    );
  }

  @Delete(':templateId')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete product template (soft delete)' })
  @ApiParam({ name: 'templateId', description: 'Product template id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Soft deletes a product template.
   */
  async delete(
    @Param('templateId') templateId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.productTemplateService.delete(
      this.productTemplateService.parseTemplateId(templateId),
      getAuditUserIdBigInt(user),
    );
  }

  @Post(':templateId/upgrade')
  @AdminOnly()
  @ApiOperation({ summary: 'Upgrade product template version references' })
  @ApiParam({ name: 'templateId', description: 'Product template id' })
  @ApiResponse({ status: 201, type: ProductTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  /**
   * Upgrades legacy product template configuration to versioned references.
   */
  async upgrade(
    @Param('templateId') templateId: string,
    @Body() dto: UpgradeProductTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ProductTemplateResponseDto> {
    return this.productTemplateService.upgrade(
      this.productTemplateService.parseTemplateId(templateId),
      dto,
      getAuditUserIdBigInt(user),
    );
  }
}
