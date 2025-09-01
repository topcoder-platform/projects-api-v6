/* eslint-disable @typescript-eslint/no-unsafe-argument */
// roles-scopes.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { PolicyService } from '../permissions/policy.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly policyService: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // read policy name
    const permission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );
    if (!permission) {
      // Do not check permission. Directly return.
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    // get request handler for this policy
    const handler = this.policyService.getPolicyHandler(permission);
    try {
      await handler(request);
    } catch (err) {
      // if any error occurs, return 403
      this.logger.warn(err);
      throw new ForbiddenException('Forbidden resource', err);
    }
    return true;
  }
}
