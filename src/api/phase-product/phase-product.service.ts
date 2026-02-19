import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhaseProduct, Prisma } from '@prisma/client';
import { CreatePhaseProductDto } from 'src/api/phase-product/dto/create-phase-product.dto';
import { UpdatePhaseProductDto } from 'src/api/phase-product/dto/update-phase-product.dto';
import { Permission } from 'src/shared/constants/permissions';
import { APP_CONFIG } from 'src/shared/config/app.config';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import { PhaseProductResponseDto } from './dto/phase-product-response.dto';

interface ProjectPermissionContext {
  id: bigint;
  directProjectId: bigint | null;
  billingAccountId: bigint | null;
  members: Array<{
    userId: bigint;
    role: string;
    deletedAt: Date | null;
  }>;
}

@Injectable()
export class PhaseProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async listPhaseProducts(
    projectId: string,
    phaseId: string,
    user: JwtUser,
  ): Promise<PhaseProductResponseDto[]> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(Permission.VIEW_PROJECT, user, project.members);
    await this.ensurePhaseExists(
      parsedProjectId,
      parsedPhaseId,
      projectId,
      phaseId,
    );

    const products = await this.prisma.phaseProduct.findMany({
      where: {
        projectId: parsedProjectId,
        phaseId: parsedPhaseId,
        deletedAt: null,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return products.map((product) => this.toDto(product));
  }

  async getPhaseProduct(
    projectId: string,
    phaseId: string,
    productId: string,
    user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');
    const parsedProductId = this.parseId(productId, 'Product');

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(Permission.VIEW_PROJECT, user, project.members);
    await this.ensurePhaseExists(
      parsedProjectId,
      parsedPhaseId,
      projectId,
      phaseId,
    );

    const product = await this.prisma.phaseProduct.findFirst({
      where: {
        id: parsedProductId,
        projectId: parsedProjectId,
        phaseId: parsedPhaseId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Phase product not found for project id ${projectId}, phase id ${phaseId}, and product id ${productId}.`,
      );
    }

    return this.toDto(product);
  }

  async createPhaseProduct(
    projectId: string,
    phaseId: string,
    dto: CreatePhaseProductDto,
    user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.ADD_PHASE_PRODUCT,
      user,
      project.members,
    );
    await this.ensurePhaseExists(
      parsedProjectId,
      parsedPhaseId,
      projectId,
      phaseId,
    );

    const productCount = await this.prisma.phaseProduct.count({
      where: {
        projectId: parsedProjectId,
        phaseId: parsedPhaseId,
        deletedAt: null,
      },
    });

    if (productCount >= APP_CONFIG.maxPhaseProductCount) {
      throw new BadRequestException(
        `Number of products per phase cannot exceed ${APP_CONFIG.maxPhaseProductCount}.`,
      );
    }

    const createdProduct = await this.prisma.phaseProduct.create({
      data: {
        projectId: parsedProjectId,
        phaseId: parsedPhaseId,
        name: dto.name,
        type: dto.type,
        templateId:
          typeof dto.templateId === 'number'
            ? BigInt(Math.trunc(dto.templateId))
            : BigInt(0),
        directProjectId:
          typeof dto.directProjectId === 'number'
            ? BigInt(Math.trunc(dto.directProjectId))
            : // Keep `/v5` behavior: default to project-level direct project id.
              project.directProjectId,
        billingAccountId:
          typeof dto.billingAccountId === 'number'
            ? BigInt(Math.trunc(dto.billingAccountId))
            : // Keep `/v5` behavior: default to project-level billing account id.
              project.billingAccountId,
        estimatedPrice:
          typeof dto.estimatedPrice === 'number' ? dto.estimatedPrice : 0,
        actualPrice: typeof dto.actualPrice === 'number' ? dto.actualPrice : 0,
        details: this.toJsonInput(dto.details || {}),
        createdBy: auditUserId,
        updatedBy: auditUserId,
      },
    });

    const response = this.toDto(createdProduct);

    return response;
  }

  async updatePhaseProduct(
    projectId: string,
    phaseId: string,
    productId: string,
    dto: UpdatePhaseProductDto,
    user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');
    const parsedProductId = this.parseId(productId, 'Product');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.UPDATE_PHASE_PRODUCT,
      user,
      project.members,
    );
    await this.ensurePhaseExists(
      parsedProjectId,
      parsedPhaseId,
      projectId,
      phaseId,
    );

    const existingProduct = await this.prisma.phaseProduct.findFirst({
      where: {
        id: parsedProductId,
        projectId: parsedProjectId,
        phaseId: parsedPhaseId,
        deletedAt: null,
      },
    });

    if (!existingProduct) {
      throw new NotFoundException(
        `Phase product not found for project id ${projectId}, phase id ${phaseId}, and product id ${productId}.`,
      );
    }

    const updatedProduct = await this.prisma.phaseProduct.update({
      where: {
        id: parsedProductId,
      },
      data: {
        name: dto.name,
        type: dto.type,
        templateId:
          typeof dto.templateId === 'number'
            ? BigInt(Math.trunc(dto.templateId))
            : undefined,
        directProjectId:
          typeof dto.directProjectId === 'number'
            ? BigInt(Math.trunc(dto.directProjectId))
            : undefined,
        billingAccountId:
          typeof dto.billingAccountId === 'number'
            ? BigInt(Math.trunc(dto.billingAccountId))
            : undefined,
        estimatedPrice: dto.estimatedPrice,
        actualPrice: dto.actualPrice,
        details:
          typeof dto.details === 'undefined'
            ? undefined
            : this.toJsonInput(dto.details),
        updatedBy: auditUserId,
      },
    });

    const response = this.toDto(updatedProduct);
    void projectId;
    void phaseId;
    void user;
    void existingProduct;

    return response;
  }

  async deletePhaseProduct(
    projectId: string,
    phaseId: string,
    productId: string,
    user: JwtUser,
  ): Promise<void> {
    const parsedProjectId = this.parseId(projectId, 'Project');
    const parsedPhaseId = this.parseId(phaseId, 'Phase');
    const parsedProductId = this.parseId(productId, 'Product');
    const auditUserId = this.getAuditUserId(user);

    const project = await this.getProjectPermissionContext(parsedProjectId);
    this.ensureNamedPermission(
      Permission.DELETE_PHASE_PRODUCT,
      user,
      project.members,
    );
    await this.ensurePhaseExists(
      parsedProjectId,
      parsedPhaseId,
      projectId,
      phaseId,
    );

    const product = await this.prisma.phaseProduct.findFirst({
      where: {
        id: parsedProductId,
        projectId: parsedProjectId,
        phaseId: parsedPhaseId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Phase product not found for project id ${projectId}, phase id ${phaseId}, and product id ${productId}.`,
      );
    }

    const deletedProduct = await this.prisma.phaseProduct.update({
      where: {
        id: parsedProductId,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: auditUserId,
        updatedBy: auditUserId,
      },
    });

    void projectId;
    void phaseId;
    void user;
    void deletedProduct;
  }

  private async ensurePhaseExists(
    projectId: bigint,
    phaseId: bigint,
    projectIdInput: string,
    phaseIdInput: string,
  ): Promise<void> {
    const phase = await this.prisma.projectPhase.findFirst({
      where: {
        id: phaseId,
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!phase) {
      throw new NotFoundException(
        `Project phase not found for project id ${projectIdInput} and phase id ${phaseIdInput}.`,
      );
    }
  }

  private async getProjectPermissionContext(
    projectId: bigint,
  ): Promise<ProjectPermissionContext> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        directProjectId: true,
        billingAccountId: true,
        members: {
          where: {
            deletedAt: null,
          },
          select: {
            userId: true,
            role: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with id ${projectId} was not found.`,
      );
    }

    return project;
  }

  private ensureNamedPermission(
    permission: Permission,
    user: JwtUser,
    projectMembers: Array<{
      userId: bigint;
      role: string;
      deletedAt: Date | null;
    }>,
  ): void {
    const hasPermission = this.permissionService.hasNamedPermission(
      permission,
      user,
      projectMembers,
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private toDto(product: PhaseProduct): PhaseProductResponseDto {
    return {
      id: product.id.toString(),
      phaseId: product.phaseId.toString(),
      projectId: product.projectId.toString(),
      directProjectId: product.directProjectId
        ? product.directProjectId.toString()
        : null,
      billingAccountId: product.billingAccountId
        ? product.billingAccountId.toString()
        : null,
      templateId: product.templateId.toString(),
      name: product.name,
      type: product.type,
      estimatedPrice: product.estimatedPrice,
      actualPrice: product.actualPrice,
      details: this.toDetailsObject(product.details),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      createdBy: product.createdBy,
      updatedBy: product.updatedBy,
    };
  }

  private toDetailsObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private parseId(value: string, entityName: string): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${entityName} id is invalid.`);
    }
  }

  private getAuditUserId(user: JwtUser): number {
    const userId = Number.parseInt(String(user.userId || ''), 10);

    if (Number.isNaN(userId)) {
      return -1;
    }

    return userId;
  }
}
