import { Prisma } from '@prisma/client';

/**
 * Recursively normalizes Prisma entity values for API/event serialization.
 *
 * - `bigint` -> `string`
 * - `Prisma.Decimal` -> `number`
 */
export function normalizeEntity<T>(payload: T): T {
  const walk = (input: unknown): unknown => {
    if (typeof input === 'bigint') {
      return input.toString();
    }

    if (input instanceof Prisma.Decimal) {
      return Number(input.toString());
    }

    if (Array.isArray(input)) {
      return input.map((entry) => walk(entry));
    }

    if (input && typeof input === 'object') {
      if (input instanceof Date) {
        return input;
      }

      const output: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        output[key] = walk(value);
      }

      return output;
    }

    return input;
  };

  return walk(payload) as T;
}
