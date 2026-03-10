import { BadRequestException } from '@nestjs/common';

/**
 * Validates and normalizes a versioned metadata key.
 */
export function normalizeVersionedConfigKey(
  key: string,
  entityName: string,
): string {
  const normalized = String(key || '').trim();

  if (!normalized) {
    throw new BadRequestException(`${entityName} key is required.`);
  }

  return normalized;
}

/**
 * Returns one record per version (latest revision first).
 */
export function pickLatestRevisionPerVersion<T extends { version: bigint }>(
  records: T[],
): T[] {
  const latestByVersion = new Map<string, T>();

  for (const record of records) {
    const versionKey = record.version.toString();
    if (!latestByVersion.has(versionKey)) {
      latestByVersion.set(versionKey, record);
    }
  }

  return Array.from(latestByVersion.values());
}
