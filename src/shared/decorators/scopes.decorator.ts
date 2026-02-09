import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const SCOPES_KEY = 'scopes';
export const SWAGGER_REQUIRED_SCOPES_KEY = 'x-required-scopes';

export const Scopes = (...scopes: string[]) =>
  applyDecorators(
    SetMetadata(SCOPES_KEY, scopes),
    ApiExtension(SWAGGER_REQUIRED_SCOPES_KEY, scopes),
  );
