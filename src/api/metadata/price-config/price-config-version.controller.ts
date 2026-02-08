import {
  Body,
  Controller,
  Delete,
  Get,
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
import {
  getAuditUserIdNumber,
  parsePositiveIntegerParam,
} from '../utils/metadata-utils';
import { CreatePriceConfigVersionDto } from './dto/create-price-config-version.dto';
import { PriceConfigResponseDto } from './dto/price-config-response.dto';
import { UpdatePriceConfigVersionDto } from './dto/update-price-config-version.dto';
import { PriceConfigService } from './price-config.service';

@ApiTags('Metadata - Price Configs')
@ApiBearerAuth()
@Controller('/projects/metadata/priceConfig/:key/versions')
export class PriceConfigVersionController {
  constructor(private readonly priceConfigService: PriceConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'List priceConfig versions',
    description:
      'Returns latest revision for each version of a priceConfig key.',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiResponse({ status: 200, type: [PriceConfigResponseDto] })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async listVersions(
    @Param('key') key: string,
  ): Promise<PriceConfigResponseDto[]> {
    return this.priceConfigService.findAllVersions(key);
  }

  @Get(':version')
  @ApiOperation({
    summary: 'Get latest revision by priceConfig version',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiResponse({ status: 200, type: PriceConfigResponseDto })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async getVersion(
    @Param('key') key: string,
    @Param('version') version: string,
  ): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.findLatestRevisionOfVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create a new priceConfig version',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiResponse({ status: 201, type: PriceConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createVersion(
    @Param('key') key: string,
    @Body() dto: CreatePriceConfigVersionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.createVersion(
      key,
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Patch(':version')
  @AdminOnly()
  @ApiOperation({
    summary: 'Update latest revision for a priceConfig version',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiResponse({ status: 200, type: PriceConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async updateVersion(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: UpdatePriceConfigVersionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<PriceConfigResponseDto> {
    return this.priceConfigService.updateVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':version')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete all revisions of a priceConfig version (soft delete)',
  })
  @ApiParam({ name: 'key', description: 'PriceConfig key' })
  @ApiParam({ name: 'version', description: 'PriceConfig version' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'PriceConfig not found' })
  async deleteVersion(
    @Param('key') key: string,
    @Param('version') version: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.priceConfigService.deleteVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      getAuditUserIdNumber(user),
    );
  }
}
