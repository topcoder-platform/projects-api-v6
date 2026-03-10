/**
 * Shared DTO transform helpers used by class-transformer decorators.
 */

/**
 * Parses optional numeric values from string/number input.
 *
 * Returns `undefined` for missing or invalid values.
 */
export function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
}

/**
 * Parses optional integer values from string/number input.
 *
 * Uses `Number()` semantics (strict string parsing), then truncates.
 */
export function parseOptionalInteger(value: unknown): number | undefined {
  const parsed = parseOptionalNumber(value);

  if (typeof parsed === 'undefined') {
    return undefined;
  }

  return Math.trunc(parsed);
}

/**
 * Parses optional integer values from string/number input.
 *
 * Uses `parseInt` semantics for string values to preserve legacy behavior.
 */
export function parseOptionalLooseInteger(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

/**
 * Parses an array of optional integers, dropping invalid entries.
 */
export function parseOptionalIntegerArray(
  value: unknown,
): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry) => parseOptionalInteger(entry))
    .filter((entry): entry is number => typeof entry === 'number');
}

/**
 * Parses optional boolean values from boolean/string input.
 */
export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
}
