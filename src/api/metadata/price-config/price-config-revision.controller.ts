import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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
import {
  getAuditUserIdNumber,
  parsePositiveIntegerParam,
} from '../utils/metadata-utils';
import { CreatePriceConfigRevisionDto } from './dto/create-price-config-revision.dto';
import { PriceConfigResponseDto } from './dto/price-config-response.dto';
import { PriceConfigService } from './price-config.service';

@ApiTags('Metadata - Price Configs')
@ApiBearerAuth()
@Controller('/projects/metadata/priceConfig/:key/versions/:version/revisions')
export class PriceConfigRevisionController {
  constructor(private readonly priceConfigService: PriceConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'List priceConfig revisions by version',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiResponse({ status: 200, type: [PriceConfigResponseDto] })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async listRevisions(
    @Param('key') key: string,
    @Param('version') version: string,
  ): Promise<PriceConfigResponseDto[]> {
    return this.priceConfigService.findAllRevisions(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
    );
  }

  @Get(':revision')
  @ApiOperation({
    summary: 'Get specific priceConfig revision',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiParam({ name: 'revision', description: 'PriceConfig revision' })
  @ApiResponse({ status: 200, type: PriceConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async getRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Param('revision') revision: string,
  ): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.findSpecificRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      BigInt(parsePositiveIntegerParam(revision, 'revision')),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create new revision under a priceConfig version',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiResponse({ status: 201, type: PriceConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async createRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: CreatePriceConfigRevisionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.createRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':revision')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete a specific priceConfig revision (soft delete)',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiParam({ name: 'revision', description: 'PriceConfig revision' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async deleteRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Param('revision') revision: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.priceConfigService.deleteRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      BigInt(parsePositiveIntegerParam(revision, 'revision')),
      getAuditUserIdNumber(user),
    );
  }
}
