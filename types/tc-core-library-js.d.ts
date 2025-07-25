// tc-core-library-js.d.ts

// Import external types
import { Request, Response, NextFunction } from 'express';

// Define types for the auth/m2m module
interface M2MAuthConfig {
  AUTH0_URL: string;
  AUTH0_AUDIENCE?: string;
  AUTH0_PROXY_SERVER_URL?: string;
  AUTH_SCOPE?: string;
  AUTH_PROVIDER?: string;
  AUTH_CONTENT_TYPE?: string;
}

interface M2MAuth {
  getMachineToken(clientId: string, clientSecret: string): Promise<string>;
}

// Define types for the auth/verifier module
interface VerifierConfig {
  validIssuers: string[];
  jwtKeyCacheTime: string;
}

export type JwtRecord = Record<string, string | number | string[] | number[] | null>;

interface Verifier {
  validateToken(token: string, secret: string, callback: (err: Error | null, decoded: JwtRecord) => void): void;
}

// Define types for the middleware/jwtAuthenticator module
interface JwtAuthenticatorOptions {
  AUTH_SECRET: string;
  VALID_ISSUERS: string;
  JWT_KEY_CACHE_TIME?: string;
}

// Define the main module types
declare module 'tc-core-library-js' {
  export const middleware: {
    jwtAuthenticator: (options: JwtAuthenticatorOptions) => (req: Request, res: Response, next: NextFunction) => void;
  };
  export const auth: {
    m2m: (config: M2MAuthConfig) => M2MAuth;
    verifier: (config: VerifierConfig) => Verifier;
  };
}
