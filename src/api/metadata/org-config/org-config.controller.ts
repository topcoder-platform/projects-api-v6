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
import { getAuditUserIdBigInt } from '../utils/metadata-utils';
import { CreateOrgConfigDto } from './dto/create-org-config.dto';
import { OrgConfigResponseDto } from './dto/org-config-response.dto';
import { UpdateOrgConfigDto } from './dto/update-org-config.dto';
import { OrgConfigService } from './org-config.service';

@ApiTags('Metadata - Org Config')
@ApiBearerAuth()
@Controller('/projects/metadata/orgConfig')
export class OrgConfigController {
  constructor(private readonly orgConfigService: OrgConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List org configs' })
  @ApiResponse({ status: 200, type: [OrgConfigResponseDto] })
  async list(): Promise<OrgConfigResponseDto[]> {
    return this.orgConfigService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get org config by id' })
  @ApiParam({ name: 'id', description: 'Org config id' })
  @ApiResponse({ status: 200, type: OrgConfigResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOne(@Param('id') id: string): Promise<OrgConfigResponseDto> {
    return this.orgConfigService.findOne(this.orgConfigService.parseId(id));
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create org config' })
  @ApiResponse({ status: 201, type: OrgConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateOrgConfigDto,
    @CurrentUser() user: JwtUser,
  ): Promise<OrgConfigResponseDto> {
    return this.orgConfigService.create(dto, getAuditUserIdBigInt(user));
  }

  @Patch(':id')
  @AdminOnly()
  @ApiOperation({ summary: 'Update org config' })
  @ApiParam({ name: 'id', description: 'Org config id' })
  @ApiResponse({ status: 200, type: OrgConfigResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrgConfigDto,
    @CurrentUser() user: JwtUser,
  ): Promise<OrgConfigResponseDto> {
    return this.orgConfigService.update(
      this.orgConfigService.parseId(id),
      dto,
      getAuditUserIdBigInt(user),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete org config (soft delete)' })
  @ApiParam({ name: 'id', description: 'Org config id' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.orgConfigService.delete(
      this.orgConfigService.parseId(id),
      getAuditUserIdBigInt(user),
    );
  }
}
