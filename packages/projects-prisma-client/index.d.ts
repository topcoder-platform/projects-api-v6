export * from './generated';

import { Prisma, PrismaClient } from './generated';

/** Options accepted by createProjectsPrismaClient. */
export interface CreateProjectsPrismaClientOptions {
  /** PostgreSQL schema override; defaults to the URL's `schema` query value. */
  schema?: string;
  /** Generated PrismaClient options other than the factory-owned adapter. */
  clientOptions?: Omit<Prisma.PrismaClientOptions, 'adapter'>;
}

/**
 * Creates a caller-owned Projects API Prisma client using PrismaPg.
 *
 * @param connectionString PostgreSQL connection string for the projects database.
 * @param options Optional schema and PrismaClient settings.
 * @returns A generated Projects API Prisma client; callers must disconnect it.
 * @throws TypeError when connectionString is missing or blank.
 */
export declare function createProjectsPrismaClient(
  connectionString: string,
  options?: CreateProjectsPrismaClientOptions,
): PrismaClient;
