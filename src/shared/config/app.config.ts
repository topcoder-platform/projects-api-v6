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

export const APP_CONFIG = {
  attachmentsS3Bucket:
    process.env.ATTACHMENTS_S3_BUCKET || 'topcoder-prod-media',
  projectAttachmentPathPrefix:
    process.env.PROJECT_ATTACHMENT_PATH_PREFIX || 'projects',
  presignedUrlExpiration: parseNumberEnv(
    process.env.PRESIGNED_URL_EXPIRATION,
    3600,
  ),
  maxPhaseProductCount: parseNumberEnv(process.env.MAX_PHASE_PRODUCT_COUNT, 20),
  enableFileUpload: parseBooleanEnv(process.env.ENABLE_FILE_UPLOAD, true),
} as const;
