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
import { CloneMilestoneTemplateDto } from './dto/clone-milestone-template.dto';
import { CreateMilestoneTemplateDto } from './dto/create-milestone-template.dto';
import { MilestoneTemplateResponseDto } from './dto/milestone-template-response.dto';
import { UpdateMilestoneTemplateDto } from './dto/update-milestone-template.dto';
import { MilestoneTemplateService } from './milestone-template.service';

@ApiTags('Metadata - Milestone Templates')
@ApiBearerAuth()
@Controller('/timelines/metadata/milestoneTemplates')
export class MilestoneTemplateController {
  constructor(
    private readonly milestoneTemplateService: MilestoneTemplateService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List milestone templates' })
  @ApiResponse({ status: 200, type: [MilestoneTemplateResponseDto] })
  async list(): Promise<MilestoneTemplateResponseDto[]> {
    return this.milestoneTemplateService.findAll();
  }

  @Get(':milestoneTemplateId')
  @ApiOperation({ summary: 'Get milestone template by id' })
  @ApiParam({
    name: 'milestoneTemplateId',
    description: 'Milestone template id',
  })
  @ApiResponse({ status: 200, type: MilestoneTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getOne(
    @Param('milestoneTemplateId') milestoneTemplateId: string,
  ): Promise<MilestoneTemplateResponseDto> {
    return this.milestoneTemplateService.findOne(
      this.milestoneTemplateService.parseId(milestoneTemplateId),
    );
  }

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create milestone template' })
  @ApiResponse({ status: 201, type: MilestoneTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateMilestoneTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<MilestoneTemplateResponseDto> {
    return this.milestoneTemplateService.create(
      dto,
      getAuditUserIdBigInt(user),
    );
  }

  @Post('clone')
  @AdminOnly()
  @ApiOperation({ summary: 'Clone milestone template' })
  @ApiResponse({ status: 201, type: MilestoneTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async clone(
    @Body() dto: CloneMilestoneTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<MilestoneTemplateResponseDto> {
    return this.milestoneTemplateService.clone(dto, getAuditUserIdBigInt(user));
  }

  @Patch(':milestoneTemplateId')
  @AdminOnly()
  @ApiOperation({ summary: 'Update milestone template' })
  @ApiParam({
    name: 'milestoneTemplateId',
    description: 'Milestone template id',
  })
  @ApiResponse({ status: 200, type: MilestoneTemplateResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @Param('milestoneTemplateId') milestoneTemplateId: string,
    @Body() dto: UpdateMilestoneTemplateDto,
    @CurrentUser() user: JwtUser,
  ): Promise<MilestoneTemplateResponseDto> {
    return this.milestoneTemplateService.update(
      this.milestoneTemplateService.parseId(milestoneTemplateId),
      dto,
      getAuditUserIdBigInt(user),
    );
  }

  @Delete(':milestoneTemplateId')
  @HttpCode(204)
  @AdminOnly()
  @ApiOperation({ summary: 'Delete milestone template (soft delete)' })
  @ApiParam({
    name: 'milestoneTemplateId',
    description: 'Milestone template id',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(
    @Param('milestoneTemplateId') milestoneTemplateId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.milestoneTemplateService.delete(
      this.milestoneTemplateService.parseId(milestoneTemplateId),
      getAuditUserIdBigInt(user),
    );
  }
}
