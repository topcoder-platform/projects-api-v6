import {
  Controller,
  Get,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/shared/decorators/public.decorator';
import { PrismaService } from 'src/shared/modules/global/prisma.service';

// TODO (quality): Move GetHealthCheckResponseDto to a dedicated src/api/health-check/dto/get-health-check-response.dto.ts file to follow the project's DTO file convention.
/**
 * Response shape returned by the health-check endpoint.
 *
 * Used by: HealthCheckController.healthCheck()
 */
export class GetHealthCheckResponseDto {
  @ApiProperty({
    description: 'Health checks run number',
    example: 1,
  })
  /** Running count of health checks executed since the last server restart. */
  checksRun: number;
}

/**
 * Controller that exposes a liveness/readiness health-check endpoint for the
 * Topcoder Project API v6.
 *
 * Route: GET /v6/projects/health (prefix applied by ApiModule -> AppModule)
 * Auth: @Public() - no JWT or M2M token required.
 *
 * The check performs a lightweight Prisma query (findFirst on the project
 * table) to verify database connectivity. If the query exceeds
 * HEALTH_CHECK_TIMEOUT ms (default 60 000 ms) it throws
 * InternalServerErrorException; any Prisma/DB error throws
 * ServiceUnavailableException.
 *
 * Used by: Kubernetes liveness probes, load-balancer health checks, and
 * platform monitoring dashboards.
 */
@ApiTags('Healthcheck')
@Controller('/projects')
export class HealthCheckController {
  private checksRun = 0;
  private readonly timeout = Number(process.env.HEALTH_CHECK_TIMEOUT || 60000);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('/health')
  @ApiOperation({ summary: 'Execute a health check' })
  /**
   * Executes a lightweight database connectivity check.
   *
   * @returns {Promise<GetHealthCheckResponseDto>} Object containing the cumulative number of health checks run since the last server restart.
   *
   * @throws {InternalServerErrorException} (HTTP 500) when the database query completes but took longer than the configured HEALTH_CHECK_TIMEOUT.
   * @throws {ServiceUnavailableException} (HTTP 503) when the database query itself throws (connection refused, query error, etc.).
   */
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
      // TODO (quality): The timeout is checked after the Prisma query resolves, so it cannot interrupt a hung database connection. Use Promise.race() with a setTimeout-based rejection to enforce a hard deadline on the query itself.
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
