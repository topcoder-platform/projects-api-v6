import {
  Controller,
  Get,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/shared/decorators/public.decorator';
import { PrismaService } from 'src/shared/modules/global/prisma.service';

export class GetHealthCheckResponseDto {
  @ApiProperty({
    description: 'Health checks run number',
    example: 1,
  })
  checksRun: number;
}

@ApiTags('Healthcheck')
@Controller('/projects')
export class HealthCheckController {
  private checksRun = 0;
  private readonly timeout = Number(process.env.HEALTH_CHECK_TIMEOUT || 60000);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('/health')
  @ApiOperation({ summary: 'Execute a health check' })
  async healthCheck(): Promise<GetHealthCheckResponseDto> {
    const response = new GetHealthCheckResponseDto();

    this.checksRun += 1;
    const startedAt = Date.now();

    try {
      await this.prisma.project.findFirst({
        select: {
          id: true,
        },
      });

      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > this.timeout) {
        throw new InternalServerErrorException('Database operation is slow.');
      }

      response.checksRun = this.checksRun;
      return response;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'There is database operation error.',
      );
    }
  }
}
