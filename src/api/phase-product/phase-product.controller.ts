import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permission } from 'src/shared/constants/permissions';
import { CurrentUser } from 'src/shared/decorators/currentUser.decorator';
import { RequirePermission } from 'src/shared/decorators/requirePermission.decorator';
import { Scopes } from 'src/shared/decorators/scopes.decorator';
import { Scope } from 'src/shared/enums/scopes.enum';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { PermissionGuard } from 'src/shared/guards/permission.guard';
import { Roles } from 'src/shared/guards/tokenRoles.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import { CreatePhaseProductDto } from './dto/create-phase-product.dto';
import { PhaseProductResponseDto } from './dto/phase-product-response.dto';
import { UpdatePhaseProductDto } from './dto/update-phase-product.dto';
import { PhaseProductService } from './phase-product.service';

@ApiTags('Phase Products')
@ApiBearerAuth()
@Controller('/projects/:projectId/phases/:phaseId/products')
/**
 * REST controller for phase products under
 * `/projects/:projectId/phases/:phaseId/products`. All endpoints require
 * `PermissionGuard`. Read endpoints require `VIEW_PROJECT`; write endpoints
 * require `ADD/UPDATE/DELETE_PHASE_PRODUCT`. Used by platform-ui Work app (via
 * `WorkItemController` alias) and the legacy Connect app.
 */
export class PhaseProductController {
  constructor(private readonly service: PhaseProductService) {}

  /**
   * Lists products belonging to a phase.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param user - Authenticated user.
   * @returns Phase product DTO list.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When project or phase is not found.
   */
  @Get()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'List phase products' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiResponse({ status: 200, type: [PhaseProductResponseDto] })
  async listPhaseProducts(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto[]> {
    return this.service.listPhaseProducts(projectId, phaseId, user);
  }

  /**
   * Fetches a single phase product.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param productId - Product id from the route.
   * @param user - Authenticated user.
   * @returns One phase product DTO.
   * @throws {BadRequestException} When route ids are invalid.
   * @throws {ForbiddenException} When the caller lacks view permission.
   * @throws {NotFoundException} When project, phase, or product is not found.
   */
  @Get(':productId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(
    Scope.PROJECTS_READ,
    Scope.PROJECTS_WRITE,
    Scope.PROJECTS_ALL,
    Scope.CONNECT_PROJECT_ADMIN,
  )
  @RequirePermission(Permission.VIEW_PROJECT)
  @ApiOperation({ summary: 'Get phase product' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiParam({ name: 'productId', required: true, description: 'Product id' })
  @ApiResponse({ status: 200, type: PhaseProductResponseDto })
  async getPhaseProduct(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    return this.service.getPhaseProduct(projectId, phaseId, productId, user);
  }

  /**
   * Creates a product under a phase.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param dto - Create payload.
   * @param user - Authenticated user.
   * @returns Created phase product DTO.
   * @throws {BadRequestException} When route ids or payload values are invalid.
   * @throws {ForbiddenException} When the caller lacks create permission.
   * @throws {NotFoundException} When project or phase is not found.
   */
  @Post()
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.ADD_PHASE_PRODUCT)
  @ApiOperation({ summary: 'Create phase product' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiBody({ type: CreatePhaseProductDto })
  @ApiResponse({ status: 201, type: PhaseProductResponseDto })
  async createPhaseProduct(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: CreatePhaseProductDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    return this.service.createPhaseProduct(projectId, phaseId, dto, user);
  }

  /**
   * Updates an existing phase product.
   *
   * @param projectId - Project id from the route.
   * @param phaseId - Phase id from the route.
   * @param productId - Product id from the route.
   * @param dto - Update payload.
   * @param user - Authenticated user.
   * @returns Updated phase product DTO.
   * @throws {BadRequestException} When ids or payload fields are invalid.
   * @throws {ForbiddenException} When the caller lacks update permission.
   * @throws {NotFoundException} When project, phase, or product is not found.
   */
  @Patch(':productId')
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.UPDATE_PHASE_PRODUCT)
  @ApiOperation({ summary: 'Update phase product' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiParam({ name: 'productId', required: true, description: 'Product id' })
  @ApiBody({ type: UpdatePhaseProductDto })
  @ApiResponse({ status: 200, type: PhaseProductResponseDto })
  async updatePhaseProduct(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdatePhaseProductDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PhaseProductResponseDto> {
    return this.service.updatePhaseProduct(
      projectId,
      phaseId,
      productId,
      dto,
      user,
    );
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
   * @throws {NotFoundException} When project, phase, or product is not found.
   */
  @Delete(':productId')
  @HttpCode(204)
  @UseGuards(PermissionGuard)
  @Roles(...Object.values(UserRole))
  @Scopes(Scope.PROJECTS_WRITE, Scope.PROJECTS_ALL, Scope.CONNECT_PROJECT_ADMIN)
  @RequirePermission(Permission.DELETE_PHASE_PRODUCT)
  @ApiOperation({ summary: 'Delete phase product' })
  @ApiParam({ name: 'projectId', required: true, description: 'Project id' })
  @ApiParam({ name: 'phaseId', required: true, description: 'Phase id' })
  @ApiParam({ name: 'productId', required: true, description: 'Product id' })
  @ApiResponse({ status: 204, description: 'Phase product removed' })
  async deletePhaseProduct(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.service.deletePhaseProduct(projectId, phaseId, productId, user);
  }
}
