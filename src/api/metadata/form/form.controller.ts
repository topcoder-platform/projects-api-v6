import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormResponseDto } from './dto/form-response.dto';
import { FormService } from './form.service';

@ApiTags('Metadata - Forms')
@ApiBearerAuth()
@Controller('/projects/metadata/form')
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Get(':key')
  @ApiOperation({
    summary: 'Get latest form revision of latest version',
    description:
      'Returns the latest revision from the latest version for the given form key.',
  })
  @ApiParam({ name: 'key', description: 'Form key' })
  @ApiResponse({ status: 200, type: FormResponseDto })
  @ApiResponse({ status: 404, description: 'Form not found' })
  async getLatest(@Param('key') key: string): Promise<FormResponseDto> {
    return this.formService.findLatestRevisionOfLatestVersion(key);
  }
}
