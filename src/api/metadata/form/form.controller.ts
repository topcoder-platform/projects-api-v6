import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/shared/decorators/public.decorator';
import { FormResponseDto } from './dto/form-response.dto';
import { FormService } from './form.service';

@ApiTags('Metadata - Forms')
@Controller('/projects/metadata/form')
/**
 * REST controller for reading public form metadata.
 */
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Public()
  @Get(':key')
  @ApiOperation({
    summary: 'Get latest form revision of latest version',
    description:
      'Returns the latest revision from the latest version for the given form key.',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiResponse({ status: 200, type: FormResponseDto })
  @ApiResponse({ status: 404, description: 'Form not found' })
  /**
   * Returns the latest revision from the latest version for a form key.
   *
   * HTTP 200 on success, 404 when key does not exist.
   */
  async getLatest(@Param('key') key: string): Promise<FormResponseDto> {
    return this.formService.findLatestRevisionOfLatestVersion(key);
  }
}
