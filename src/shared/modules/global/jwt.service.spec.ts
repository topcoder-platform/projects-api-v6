import * as jwt from 'jsonwebtoken';
import { JwtService } from './jwt.service';

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, 'test-secret');
}

describe('JwtService', () => {
  let service: JwtService;

  beforeEach(() => {
    service = new JwtService();
  });

  it('prefers numeric userId claim over non-numeric sub', async () => {
    const token = signToken({
      userId: 12345,
      sub: 'auth0|abcd',
    });

    const user = await service.validateToken(token);

    expect(user.userId).toBe('12345');
  });

  it('uses namespaced userId claim when sub is non-numeric', async () => {
    const token = signToken({
      sub: 'auth0|abcd',
      'https://topcoder.com/userId': 67890,
    });

    const user = await service.validateToken(token);

    expect(user.userId).toBe('67890');
  });

  it('falls back to sub when user id claim is unavailable', async () => {
    const token = signToken({
      sub: 'auth0|abcd',
    });

    const user = await service.validateToken(token);

    expect(user.userId).toBe('auth0|abcd');
  });
});
