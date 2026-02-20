import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { LoggerService } from './logger.service';
import { PrismaErrorService } from './prisma-error.service';

/**
 * Global Prisma service for project-service-v6.
 *
 * This module provides the singleton database client used across the app and
 * wires database lifecycle hooks into NestJS startup/shutdown events. It also
 * centralizes datasource configuration, connection pooling parameters, and
 * slow-query monitoring.
 */
// TODO (quality): These three helpers are module-level functions; consider converting them to private static methods on PrismaService for better encapsulation and testability.
/**
 * Resolves the interactive transaction timeout in milliseconds.
 *
 * @returns {number} Timeout value in milliseconds from PROJECT_SERVICE_PRISMA_TIMEOUT.
 */
function getTransactionTimeout(): number {
  return Number(process.env.PROJECT_SERVICE_PRISMA_TIMEOUT || 10000);
}

// TODO (quality): These three helpers are module-level functions; consider converting them to private static methods on PrismaService for better encapsulation and testability.
/**
 * Resolves the datasource URL for Prisma.
 *
 * In production, default connection-pool query parameters are appended when
 * absent.
 *
 * @returns {string | undefined} The resolved datasource URL or undefined when not configured.
 */
function getDatasourceUrl(): string | undefined {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return undefined;
  }

  if (process.env.NODE_ENV !== 'production') {
    return databaseUrl;
  }

  try {
    const url = new URL(databaseUrl);

    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '20');
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '20');
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

// TODO (quality): These three helpers are module-level functions; consider converting them to private static methods on PrismaService for better encapsulation and testability.
/**
 * Extracts the Prisma schema name from a datasource URL.
 *
 * @param {string | undefined} datasourceUrl Datasource URL to inspect.
 * @returns {string | undefined} Schema name from the `schema` query param, if present.
 */
function getSchemaFromDatasourceUrl(
  datasourceUrl: string | undefined,
): string | undefined {
  if (!datasourceUrl) {
    return undefined;
  }

  try {
    return new URL(datasourceUrl).searchParams.get('schema') ?? undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
/**
 * Singleton Prisma client with NestJS lifecycle integration.
 *
 * Extends PrismaClient to configure the PostgreSQL adapter, connection and
 * transaction options, and Prisma log listeners used for query observability.
 */
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = LoggerService.forRoot('PrismaService');

  /**
   * Creates a configured Prisma client instance.
   *
   * Sets up the Prisma PostgreSQL adapter, applies transaction timeout options,
   * and registers Prisma event listeners for query/info/warn/error logs.
   *
   * @param {PrismaErrorService} prismaErrorService Service that normalizes Prisma exceptions.
   */
  constructor(private readonly prismaErrorService: PrismaErrorService) {
    const datasourceUrl = getDatasourceUrl();
    const schema = getSchemaFromDatasourceUrl(datasourceUrl);
    const adapter = new PrismaPg(
      { connectionString: datasourceUrl },
      schema ? { schema } : undefined,
    );

    super({
      adapter,
      transactionOptions: {
        timeout: getTransactionTimeout(),
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      const queryDurationMs = event.duration;

      if (process.env.NODE_ENV !== 'production') {
        // TODO (security): In non-production environments, all query parameters are logged (line 87). This may expose sensitive data such as PII or credentials. Consider redacting params in all environments.
        this.logger.debug(
          `Query: ${event.query} | Params: ${event.params} | Duration: ${queryDurationMs}ms`,
        );
        return;
      }

      if (queryDurationMs > 500) {
        this.logger.warn(
          `Slow query detected. Duration: ${queryDurationMs}ms | Query: ${event.query}`,
        );
      }
    });

    this.$on('info' as never, (event: Prisma.LogEvent) => {
      this.logger.log(`Prisma info: ${event.message}`);
    });

    this.$on('warn' as never, (event: Prisma.LogEvent) => {
      this.logger.warn(`Prisma warning: ${event.message}`);
    });

    this.$on('error' as never, (event: Prisma.LogEvent) => {
      this.logger.error(`Prisma error: ${event.message}`, event.target);
    });
  }

  /**
   * Connects Prisma when the module is initialized.
   *
   * In production, also applies session-level database settings.
   *
   * @returns {Promise<void>}
   * @throws Delegates connection errors to PrismaErrorService.handleError.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Prisma connection');

    try {
      await this.$connect();
      this.logger.log('Prisma connected successfully');

      if (process.env.NODE_ENV === 'production') {
        try {
          // TODO (security): $executeRawUnsafe is used on line 120 to set statement_timeout. Although the string is hardcoded and not injectable, prefer $executeRaw with a tagged template or a Prisma-native option if one becomes available.
          await this.$executeRawUnsafe('SET statement_timeout = 30000');
          this.logger.log('Production connection settings configured');
        } catch (error) {
          this.logger.warn(
            `Failed to apply production database session settings: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      this.prismaErrorService.handleError(error, 'connecting to database');
    }
  }

  /**
   * Disconnects Prisma during module teardown.
   *
   * @returns {Promise<void>}
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Prisma');
    await this.$disconnect();
  }
}
