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
import { ProjectPermissionContext } from 'src/shared/interfaces/project-permission-context.interface';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { PrismaService } from 'src/shared/modules/global/prisma.service';
import { PermissionService } from 'src/shared/services/permission.service';
import {
  ensureProjectNamedPermission,
  getAuditUserIdOrDefault,
  loadProjectPermissionContext,
  parseBigIntId,
  toDetailsObject as toDetailsObjectValue,
  toJsonInput as toJsonInputValue,
} from 'src/shared/utils/service.utils';
import { PhaseProductResponseDto } from './dto/phase-product-response.dto';

@Injectable()
/**
 * Business logic for phase products. Enforces a per-phase product count limit
 * (`APP_CONFIG.maxPhaseProductCount`, default 20). Inherits
 * `directProjectId` and `billingAccountId` from the parent project when not
 * explicitly provided, preserving v5 behavior. Used by
 * `PhaseProductController` and `WorkItemController`.
 */
export class PhaseProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * Validates project and phase existence, then lists non-deleted products
   * ordered by ascending id.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param user - Authenticated user.
   * @returns Product DTO list.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When project or phase is not found.
   */
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

  /**
   * Validates project and phase, then fetches one non-deleted product.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param productId - Product id from the route.
   * @param user - Authenticated user.
   * @returns Product DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When phase or product is missing.
   */
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

  /**
   * Creates a phase product with product-count guardrails and defaulting for
   * `directProjectId`/`billingAccountId` from the parent project.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param dto - Create payload.
   * @param user - Authenticated user.
   * @returns Created product DTO.
   * @throws {BadRequestException} When input is invalid or per-phase limit is exceeded.
   * @throws {ForbiddenException} When the caller lacks create permission.
   * @throws {NotFoundException} When project or phase is missing.
   */
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

  /**
   * Partially updates a phase product. `templateId`, `directProjectId`, and
   * `billingAccountId` are updated only when provided as numbers.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param productId - Product id from the route.
   * @param dto - Update payload.
   * @param user - Authenticated user.
   * @returns Updated product DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks update permission.
   * @throws {NotFoundException} When phase or product is missing.
   */
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
    // TODO [QUALITY]: Remove unused `void` suppressions; these variables are already used earlier in the method or should be removed from scope.
    void projectId;
    void phaseId;
    void user;
    void existingProduct;

    return response;
  }

  /**
   * Soft deletes a phase product.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param productId - Product id from the route.
   * @param user - Authenticated user.
   * @returns Nothing.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks delete permission.
   * @throws {NotFoundException} When phase or product is missing.
   */
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

    // TODO [QUALITY]: Remove unused `void` suppressions; these variables are already used earlier in the method or should be removed from scope.
    void projectId;
    void phaseId;
    void user;
    void deletedProduct;
  }

  /**
   * Ensures a non-deleted phase exists for the given project.
   *
   * @param projectId - Parsed project id.
   * @param phaseId - Parsed phase id.
   * @param projectIdInput - Raw project id for error messages.
   * @param phaseIdInput - Raw phase id for error messages.
   * @returns Nothing.
   * @throws {NotFoundException} When the phase is not found.
   */
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

  /**
   * Loads project permission context used by permission checks and defaulting.
   *
   * @param projectId - Parsed project id.
   * @returns Project permission context.
   * @throws {NotFoundException} When the project does not exist.
   */
  private async getProjectPermissionContext(
    projectId: bigint,
  ): Promise<ProjectPermissionContext> {
    return loadProjectPermissionContext(this.prisma, projectId);
  }

  /**
   * Enforces a named permission against project members.
   *
   * @param permission - Permission to verify.
   * @param user - Authenticated user.
   * @param projectMembers - Active project members.
   * @returns Nothing.
   * @throws {ForbiddenException} When permission is missing.
   */
  private ensureNamedPermission(
    permission: Permission,
    user: JwtUser,
    projectMembers: Array<{
      userId: bigint;
      role: string;
      deletedAt: Date | null;
    }>,
  ): void {
    ensureProjectNamedPermission(
      this.permissionService,
      permission,
      user,
      projectMembers,
    );
  }

  /**
   * Maps a phase product entity into response DTO form.
   *
   * @param product - Phase product entity.
   * @returns Serialized response DTO.
   */
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

  /**
   * Safely converts unknown JSON-like details to plain object form.
   *
   * @param value - Candidate JSON value.
   * @returns Object details payload.
   */
  private toDetailsObject(value: unknown): Record<string, unknown> {
    return toDetailsObjectValue(value);
  }

  /**
   * Converts arbitrary values to Prisma JSON input semantics.
   *
   * @param value - Candidate JSON value.
   * @returns Prisma JSON value, JsonNull, or undefined.
   */
  private toJsonInput(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
    return toJsonInputValue(value);
  }

  /**
   * Parses route ids as bigint values.
   *
   * @param value - Raw id value.
   * @param entityName - Entity name for error context.
   * @returns Parsed id.
   * @throws {BadRequestException} When parsing fails.
   */
  private parseId(value: string, entityName: string): bigint {
    return parseBigIntId(value, entityName);
  }

  /**
   * Parses authenticated user id for audit fields.
   *
   * @param user - Authenticated user.
   * @returns Numeric audit user id.
   */
  // TODO [SECURITY]: Returning `-1` silently when `user.userId` is invalid can corrupt audit trails; throw `UnauthorizedException` instead.
  private getAuditUserId(user: JwtUser): number {
    return getAuditUserIdOrDefault(user, -1);
  }
}
