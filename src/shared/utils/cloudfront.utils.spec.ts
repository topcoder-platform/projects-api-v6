describe('signCloudFrontUrl', () => {
  const url = 'https://cdn.example.com/private/report.pdf';
  const mockSignedUrl = `${url}?signature=abc`;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_KEY_PAIR_ID;
    delete process.env.CLOUDFRONT_KEY_PAIR_ID;
    delete process.env.CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PRIVATE_KEY;
  });

  it('returns original URL when signing keys are missing', () => {
    jest.isolateModules(() => {
      const { signCloudFrontUrl } =
        jest.requireActual<typeof import('./cloudfront.utils')>(
          './cloudfront.utils',
        );
      expect(signCloudFrontUrl(url)).toBe(url);
    });
  });

  it('signs the URL when CloudFront key pair id and private key are configured', () => {
    process.env.CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_KEY_PAIR_ID = 'KP_ID';
    process.env.CLOUDFRONT_PROJECT_SHOWCASE_MEDIA_PRIVATE_KEY =
      '-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAuR1qVAvV+7Z2qmeJ\n-----END PRIVATE KEY-----';

    jest.mock('@aws-sdk/cloudfront-signer', () => ({
      getSignedUrl: jest.fn(() => mockSignedUrl),
    }));

    jest.isolateModules(() => {
      const { signCloudFrontUrl } =
        jest.requireActual<typeof import('./cloudfront.utils')>(
          './cloudfront.utils',
        );
      expect(signCloudFrontUrl(url)).toBe(mockSignedUrl);
    });
  });
});
