import { Controller, Get, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from 'src/shared/services/prisma.service';

export class HealthResponse {
  @ApiProperty({ name: 'message', description: 'Health check message' })
  message: string;
}

@Controller('/projects/health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Check application running status' })
  @ApiResponse({ status: HttpStatus.OK, type: HealthResponse })
  async check(): Promise<HealthResponse> {
    // query data from db
    await this.prisma.project.findFirst({});

    return { message: 'All-is-well' };
  }
}
