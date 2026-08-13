'use strict';

const { PrismaPg } = require('@prisma/adapter-pg');
const generatedClient = require('./generated');

/**
 * Resolves a PostgreSQL schema from an explicit factory option or the
 * connection string's `schema` query parameter.
 *
 * @param {string} connectionString PostgreSQL connection string.
 * @param {string | undefined} schema Explicit schema override.
 * @returns {string | undefined} Schema passed to PrismaPg.
 */
function resolveSchema(connectionString, schema) {
  if (schema) {
    return schema;
  }

  try {
    return new URL(connectionString).searchParams.get('schema') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Creates a Projects API Prisma client backed by Prisma's PostgreSQL adapter.
 *
 * @param {string} connectionString PostgreSQL connection string for the
 * projects database.
 * @param {{schema?: string, clientOptions?: object}} [options] Optional schema
 * override and generated PrismaClient constructor options (for example `log`
 * or `transactionOptions`).
 * @returns {import('./generated').PrismaClient} A caller-owned Prisma client.
 * @throws {TypeError} If connectionString is missing or blank.
 */
function createProjectsPrismaClient(connectionString, options = {}) {
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    throw new TypeError('connectionString must be a non-empty string.');
  }

  const schema = resolveSchema(connectionString, options.schema);
  const adapter = new PrismaPg(
    { connectionString },
    schema ? { schema } : undefined,
  );

  return new generatedClient.PrismaClient({
    ...(options.clientOptions || {}),
    adapter,
  });
}

module.exports = {
  ...generatedClient,
  createProjectsPrismaClient,
};
