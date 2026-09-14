export * from './generated';

import { Prisma, PrismaClient } from './generated';

/** PostgreSQL timeout settings accepted by the external client factory. */
export interface ProjectsPostgresDriverOptions {
  /** Maximum time to acquire or establish a connection. */
  connectionTimeoutMillis?: number;
  /** Client-side query deadline in milliseconds. */
  query_timeout?: number;
  /** PostgreSQL server-side statement deadline in milliseconds. */
  statement_timeout?: number;
}

/** Options accepted by createProjectsPrismaClient. */
export interface CreateProjectsPrismaClientOptions {
  /** PostgreSQL schema override; defaults to the URL's `schema` query value. */
  schema?: string;
  /** PostgreSQL driver connection and query timeout settings. */
  driverOptions?: ProjectsPostgresDriverOptions;
  /** Generated PrismaClient options other than the factory-owned adapter. */
  clientOptions?: Omit<Prisma.PrismaClientOptions, 'adapter'>;
}

/**
 * Creates a caller-owned Projects API Prisma client using PrismaPg.
 *
 * @param connectionString PostgreSQL connection string for the projects database.
 * @param options Optional schema, PostgreSQL driver, and PrismaClient settings.
 * @returns A generated Projects API Prisma client; callers must disconnect it.
 * @throws TypeError when connectionString is missing or blank.
 */
export declare function createProjectsPrismaClient(
  connectionString: string,
  options?: CreateProjectsPrismaClientOptions,
): PrismaClient;
