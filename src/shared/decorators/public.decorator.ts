/**
 * Public-route decorator for bypassing `TokenRolesGuard`.
 */
import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used to mark handlers/controllers as public.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route or controller as public.
 *
 * `TokenRolesGuard` reads this metadata and immediately allows the request.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
