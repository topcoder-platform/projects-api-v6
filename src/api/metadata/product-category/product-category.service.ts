import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductCategory } from '@prisma/client';
import { PrismaErrorService } from 'src/shared/modules/global/prisma-error.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { EventBusService } from 'src/shared/modules/global/eventBus.service';
import {
  PROJECT_METADATA_RESOURCE,
  publishMetadataEvent,
} from '../utils/metadata-event.utils';
import { toSerializable } from '../utils/metadata-utils';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { ProductCategoryResponseDto } from './dto/product-category-response.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaErrorService: PrismaErrorService,
    private readonly eventBusService: EventBusService,
  ) {}

  async findAll(): Promise<ProductCategoryResponseDto[]> {
    const records = await this.prisma.productCategory.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ key: 'asc' }],
    });

    return records.map((record) => this.toDto(record));
  }

  async findByKey(key: string): Promise<ProductCategoryResponseDto> {
    const record = await this.prisma.productCategory.findFirst({
      where: {
        key,
        deletedAt: null,
      },
    });

    if (!record) {
      throw new NotFoundException(`Product category not found for key ${key}.`);
    }

    return this.toDto(record);
  }

  async create(
    dto: CreateProductCategoryDto,
    userId: number,
  ): Promise<ProductCategoryResponseDto> {
    try {
      const existing = await this.prisma.productCategory.findUnique({
        where: {
          key: dto.key,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Product category already exists for key ${dto.key}.`,
        );
      }

      const created = await this.prisma.productCategory.create({
        data: {
          key: dto.key,
          displayName: dto.displayName,
          icon: dto.icon,
          question: dto.question,
          info: dto.info,
          aliases: dto.aliases as Prisma.InputJsonValue,
          disabled: dto.disabled || false,
          hidden: dto.hidden || false,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_CREATE',
        PROJECT_METADATA_RESOURCE.PRODUCT_CATEGORY,
        created.key,
        created,
        userId,
      );

      return this.toDto(created);
    } catch (error) {
      this.handleError(error, `create product category ${dto.key}`);
    }
  }

  async update(
    key: string,
    dto: UpdateProductCategoryDto,
    userId: number,
  ): Promise<ProductCategoryResponseDto> {
    try {
      const existing = await this.prisma.productCategory.findFirst({
        where: {
          key,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Product category not found for key ${key}.`,
        );
      }

      const updated = await this.prisma.productCategory.update({
        where: {
          key,
        },
        data: {
          ...(typeof dto.displayName === 'undefined'
            ? {}
            : { displayName: dto.displayName }),
          ...(typeof dto.icon === 'undefined' ? {} : { icon: dto.icon }),
          ...(typeof dto.question === 'undefined'
            ? {}
            : { question: dto.question }),
          ...(typeof dto.info === 'undefined' ? {} : { info: dto.info }),
          ...(typeof dto.aliases === 'undefined'
            ? {}
            : { aliases: dto.aliases as Prisma.InputJsonValue }),
          ...(typeof dto.disabled === 'undefined'
            ? {}
            : { disabled: dto.disabled }),
          ...(typeof dto.hidden === 'undefined' ? {} : { hidden: dto.hidden }),
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_UPDATE',
        PROJECT_METADATA_RESOURCE.PRODUCT_CATEGORY,
        updated.key,
        updated,
        userId,
      );

      return this.toDto(updated);
    } catch (error) {
      this.handleError(error, `update product category ${key}`);
    }
  }

  async delete(key: string, userId: number): Promise<void> {
    try {
      const existing = await this.prisma.productCategory.findFirst({
        where: {
          key,
          deletedAt: null,
        },
        select: {
          key: true,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          `Product category not found for key ${key}.`,
        );
      }

      await this.prisma.productCategory.update({
        where: {
          key,
        },
        data: {
          deletedAt: new Date(),
          deletedBy: userId,
          updatedBy: userId,
        },
      });

      await publishMetadataEvent(
        this.eventBusService,
        'PROJECT_METADATA_DELETE',
        PROJECT_METADATA_RESOURCE.PRODUCT_CATEGORY,
        key,
        { key },
        userId,
      );
    } catch (error) {
      this.handleError(error, `delete product category ${key}`);
    }
  }

  private toDto(record: ProductCategory): ProductCategoryResponseDto {
    return {
      key: record.key,
      displayName: record.displayName,
      icon: record.icon,
      question: record.question,
      info: record.info,
      aliases: toSerializable(record.aliases || []) as unknown[],
      disabled: record.disabled,
      hidden: record.hidden,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
    };
  }

  private handleError(error: unknown, operation: string): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.prismaErrorService.handleError(error, operation);
  }
}
