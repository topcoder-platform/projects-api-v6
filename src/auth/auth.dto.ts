/**
 * User parsed from JWT
 */
export class JwtUser {
  userId?: number;
  handle?: string;
  sub?: string;
  roles: string[];
  scopes: string[];
  email?: string;
  isMachine?: boolean;
}
