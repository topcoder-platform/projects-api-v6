import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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
import { CreateFormRevisionDto } from './dto/create-form-revision.dto';
import { FormResponseDto } from './dto/form-response.dto';
import { FormService } from './form.service';

@ApiTags('Metadata - Forms')
@ApiBearerAuth()
@Controller('/projects/metadata/form/:key/versions/:version/revisions')
/**
 * REST controller for form revision operations.
 *
 * Read endpoints are public (`@Public()`); write endpoints require
 * `@AdminOnly`.
 */
export class FormRevisionController {
  constructor(private readonly formService: FormService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List form revisions by version',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiResponse({ status: 200, type: [FormResponseDto] })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Lists all revisions for a form version.
   *
   * HTTP 200 on success.
   */
  async listRevisions(
    @Param('key') key: string,
    @Param('version') version: string,
  ): Promise<FormResponseDto[]> {
    return this.formService.findAllRevisions(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
    );
  }

  @Public()
  @Get(':revision')
  @ApiOperation({
    summary: 'Get specific form revision',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiParam({ name: 'revision', description: 'Form revision' })
  @ApiResponse({ status: 200, type: FormResponseDto })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Fetches one exact form revision.
   *
   * HTTP 200 on success.
   */
  async getRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Param('revision') revision: string,
  ): Promise<FormResponseDto> {
    return this.formService.findSpecificRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      BigInt(parsePositiveIntegerParam(revision, 'revision')),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({
    summary: 'Create new revision under a form version',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiResponse({ status: 201, type: FormResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Creates a new revision under a form version.
   *
   * HTTP 201 on success.
   */
  async createRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Body() dto: CreateFormRevisionDto,
    @CurrentUser() user: JwtUser,
  ): Promise<FormResponseDto> {
    return this.formService.createRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      dto.config,
      getAuditUserIdNumber(user),
    );
  }

  @Delete(':revision')
  @AdminOnly()
  @ApiOperation({
    summary: 'Delete a specific form revision (soft delete)',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiParam({ name: 'version', description: 'Form version' })
  @ApiParam({ name: 'revision', description: 'Form revision' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Soft deletes one form revision.
   *
   * HTTP 204 on success.
   */
  async deleteRevision(
    @Param('key') key: string,
    @Param('version') version: string,
    @Param('revision') revision: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.formService.deleteRevision(
      key,
      BigInt(parsePositiveIntegerParam(version, 'version')),
      BigInt(parsePositiveIntegerParam(revision, 'revision')),
      getAuditUserIdNumber(user),
    );
  }
}
