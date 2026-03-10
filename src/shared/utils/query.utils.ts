import { BadRequestException } from '@nestjs/common';

export type SortDirection = 'asc' | 'desc';

/**
 * Parses `sort` query expressions (`field` or `field direction`) into
 * Prisma-compatible `orderBy` objects.
 */
export function parseSortParam(
  sort: string | undefined,
  allowedFields: readonly string[],
  defaultOrder: Record<string, SortDirection>,
): Record<string, SortDirection> {
  if (!sort || sort.trim().length === 0) {
    return defaultOrder;
  }

  const normalized = sort.trim();
  const withDirection = normalized.includes(' ')
    ? normalized
    : `${normalized} asc`;
  const [field, direction] = withDirection.split(/\s+/);

  if (!field || !direction || !allowedFields.includes(field)) {
    throw new BadRequestException('Invalid sort criteria.');
  }

  const normalizedDirection = direction.toLowerCase();
  if (normalizedDirection !== 'asc' && normalizedDirection !== 'desc') {
    throw new BadRequestException('Invalid sort criteria.');
  }

  return {
    [field]: normalizedDirection,
  };
}
