/**
 * Scope-based authorization decorator for M2M access rules.
 */
import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

/**
 * Metadata key for required token scopes.
 */
export const SCOPES_KEY = 'scopes';
/**
 * Swagger extension key listing required scopes per operation.
 */
export const SWAGGER_REQUIRED_SCOPES_KEY = 'x-required-scopes';

/**
 * Declares required OAuth scopes for a route.
 *
 * The decorator writes both runtime metadata and Swagger metadata.
 *
 * @param scopes Allowed scopes for this endpoint.
 */
export const Scopes = (...scopes: string[]) =>
  applyDecorators(
    SetMetadata(SCOPES_KEY, scopes),
    ApiExtension(SWAGGER_REQUIRED_SCOPES_KEY, scopes),
  );
