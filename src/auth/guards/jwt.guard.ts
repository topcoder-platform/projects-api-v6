import { CanActivate, ExecutionContext, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { JwtUser } from '../auth.dto';
import { JwtService } from '../jwt/jwt.service';

// create jwt service
const jwtService = new JwtService();

@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isJwtRequired = this.reflector.get<boolean>(
      'jwtRequired',
      context.getHandler(),
    ) || this.reflector.get<boolean>(
      'jwtRequired',
      context.getClass(),
    );

    if (!isJwtRequired) {
      return true;
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const response = ctx.getResponse<Response>();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      response.status(HttpStatus.UNAUTHORIZED).json('No token provided.');
      return false;
    }
    const token = req.headers.authorization?.split(' ')[1];
    // verify jwt token
    let authUser: JwtUser;
    try {
      authUser = await jwtService.verify(token as string);
    } catch (err) {
      this.logger.warn(`Error occurs while verifying jwt token.`, err);
      response.status(HttpStatus.UNAUTHORIZED).json('Jwt token invalid');
      return false;
    }
    // put auth user into request and proceed
    req['user'] = authUser;
    return true;
  }
}
