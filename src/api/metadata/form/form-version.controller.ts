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
import { Public } from 'src/shared/decorators/public.decorator';
import { AdminOnly } from 'src/shared/guards/adminOnly.guard';
import { JwtUser } from 'src/shared/modules/global/jwt.service';
import {
  getAuditUserIdNumber,
  parsePositiveIntegerParam,
} from '../utils/metadata-utils';
import { CreateFormVersionDto } from './dto/create-form-version.dto';
import { FormResponseDto } from './dto/form-response.dto';
import { UpdateFormVersionDto } from './dto/update-form-version.dto';
import { FormService } from './form.service';

@ApiTags('Metadata - Forms')
@ApiBearerAuth()
@Controller('/projects/metadata/form/:key/versions')
/**
 * REST controller for form version operations.
 *
 * Read endpoints are public (`@Public()`); write endpoints require
 * `@AdminOnly`.
 */
export class FormVersionController {
  constructor(private readonly formService: FormService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List form versions',
    description: 'Returns latest revision for each version of a form key.',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiResponse({ status: 200, type: [FormResponseDto] })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Lists the latest revision of each version for a form key.
   *
   * HTTP 200 on success.
   */
  async listVersions(@Param('key') key: string): Promise<FormResponseDto[]> {
    return this.formService.findAllVersions(key);
  }

  @Public()
  @Get(':version')
  @ApiOperation({
    summary: 'Get latest revision by form version',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiResponse({ status: 200, type: FormResponseDto })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Fetches latest revision for one form version.
   *
   * HTTP 200 on success.
   */
  async getVersion(
    @Param('key') key: string,
    @Param('version') version: string,
  ): Promise<FormResponseDto> {
    return this.formService.findLatestRevisionOfVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create a new form version',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiResponse({ status: 201, type: FormResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  /**
   * Creates a new form version.
   *
   * HTTP 201 on success.
   */
  async createVersion(
    @Param('key') key: string,
    @Body() dto: CreateFormVersionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<FormResponseDto> {
    return this.formService.createVersion(
      key,
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Patch(':version')
  @AdminOnly()
  @ApiOperation({
    summary: 'Update latest revision for a form version',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiResponse({ status: 200, type: FormResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Updates the latest revision for a form version.
   *
   * HTTP 200 on success.
   */
  async updateVersion(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: UpdateFormVersionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<FormResponseDto> {
    return this.formService.updateVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':version')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete all revisions of a form version (soft delete)',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Soft deletes all revisions in a form version.
   *
   * HTTP 204 on success.
   */
  async deleteVersion(
    @Param('key') key: string,
    @Param('version') version: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.formService.deleteVersion(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      getAuditUserIdNumber(user),
    );
  }
}
