import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { APP_CONFIG } from 'src/shared/config/app.config';

function normalizePemKey(rawKey: string | undefined): string | undefined {
  if (!rawKey) {
    return undefined;
  }

  let normalized = rawKey.trim();

  while (normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }

  const pemMatch = normalized.match(
    /-----BEGIN ([A-Z0-9 ]+)-----\s*([A-Za-z0-9+/=\s]+)\s*-----END \1-----/s,
  );
  if (pemMatch) {
    const [, keyType, keyBody] = pemMatch;
    const compactBody = keyBody.replace(/\s+/g, '');

    if (compactBody.length > 0) {
      const wrappedBody = compactBody.match(/.{1,64}/g)?.join('\n') || '';
      normalized = [
        `-----BEGIN ${keyType}-----`,
        wrappedBody,
        `-----END ${keyType}-----`,
      ].join('\n');
    }
  }

  if (!normalized.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(normalized, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) {
        normalized = decoded;
      }
    } catch {
      // Keep the original value if decoding fails.
    }
  }

  return normalized.trim();
}

export function signCloudFrontUrl(url: string): string {
  const keyPairId = APP_CONFIG.cloudFrontProjectShowcaseMediaKeyPairId;
  const privateKey = normalizePemKey(
    APP_CONFIG.cloudFrontProjectShowcaseMediaPrivateKey,
  );

  if (!keyPairId || !privateKey) {
    return url;
  }

  try {
    return getSignedUrl({
      url,
      keyPairId,
      privateKey,
      dateLessThan: new Date(
        Date.now() + APP_CONFIG.cloudFrontProjectShowcaseMediaUrlExpiration * 1000,
      ).toISOString(),
    });
  } catch {
    return url;
  }
}
