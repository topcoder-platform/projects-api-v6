import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { LoggerService } from './logger.service';
import { PrismaErrorService } from './prisma-error.service';

function getTransactionTimeout(): number {
  return Number(process.env.PROJECT_SERVICE_PRISMA_TIMEOUT || 10000);
}

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

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = LoggerService.forRoot('PrismaService');

  constructor(private readonly prismaErrorService: PrismaErrorService) {
    super({
      transactionOptions: {
        timeout: getTransactionTimeout(),
      },
      log: [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
      datasources: {
        db: {
          url: getDatasourceUrl(),
        },
      },
    });

    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      const queryDurationMs = event.duration;

      if (process.env.NODE_ENV !== 'production') {
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

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Prisma connection');

    try {
      await this.$connect();
      this.logger.log('Prisma connected successfully');

      if (process.env.NODE_ENV === 'production') {
        try {
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

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting Prisma');
    await this.$disconnect();
  }
}
