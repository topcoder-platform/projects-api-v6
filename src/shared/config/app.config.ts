/**
 * Application-level configuration loaded from environment variables at module
 * initialization time.
 */
/**
 * Parses a boolean-like environment value.
 *
 * Accepts `true`/`false` (case-insensitive) and falls back for undefined or
 * unrecognized values.
 */
function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (typeof value === 'undefined') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return fallback;
}

/**
 * Parses a numeric environment value.
 *
 * Returns the fallback for undefined inputs or `NaN` parsing results.
 */
function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (typeof value === 'undefined') {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

/**
 * Runtime app configuration.
 */
export const APP_CONFIG = {
  /**
   * S3 bucket used for project attachment storage.
   * Env: `ATTACHMENTS_S3_BUCKET`, default: `topcoder-prod-media`.
   */
  attachmentsS3Bucket:
    process.env.ATTACHMENTS_S3_BUCKET || 'topcoder-prod-media',
  /**
   * S3 key prefix used for project attachment objects.
   * Env: `PROJECT_ATTACHMENT_PATH_PREFIX`, default: `projects`.
   */
  projectAttachmentPathPrefix:
    process.env.PROJECT_ATTACHMENT_PATH_PREFIX || 'projects',
  /**
   * Pre-signed URL expiration in seconds.
   * Env: `PRESIGNED_URL_EXPIRATION`, default: `3600`.
   */
  presignedUrlExpiration: parseNumberEnv(
    process.env.PRESIGNED_URL_EXPIRATION,
    3600,
  ),
  /**
   * Maximum number of phase products per phase.
   * Env: `MAX_PHASE_PRODUCT_COUNT`, default: `20`.
   */
  maxPhaseProductCount: parseNumberEnv(process.env.MAX_PHASE_PRODUCT_COUNT, 20),
  /**
   * Feature flag controlling file upload endpoints.
   * Env: `ENABLE_FILE_UPLOAD`, default: `true`.
   *
   * @security Required env vars are not centrally validated on startup.
   * Add startup validation (for example in `main.ts`) to fail fast when
   * `ATTACHMENTS_S3_BUCKET` is missing in production.
   */
  enableFileUpload: parseBooleanEnv(process.env.ENABLE_FILE_UPLOAD, true),
} as const;
