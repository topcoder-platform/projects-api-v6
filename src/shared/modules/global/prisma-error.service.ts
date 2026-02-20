import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoggerService } from './logger.service';

/**
 * Prisma exception normalization utilities.
 *
 * Centralizes translation of Prisma client/runtime errors into HTTP exceptions
 * that can be returned consistently by API handlers.
 */
@Injectable()
/**
 * Maps Prisma error variants and known Prisma error codes to NestJS HTTP
 * exceptions.
 *
 * Known request error codes currently handled:
 * - P2002: unique constraint violation
 * - P2003: foreign key constraint violation
 * - P2025: record not found
 */
export class PrismaErrorService {
  private readonly logger = LoggerService.forRoot('PrismaErrorService');

  // TODO (quality): Parameter 'error' is typed as 'any'. Change to 'unknown' and use type narrowing already present in the method body for stricter type safety.
  /**
   * Handles a Prisma error by logging context and throwing an HTTP exception.
   *
   * @param {any} error Raw error thrown by Prisma.
   * @param {string} operation Human-readable database operation context for logs.
   * @returns {never} This method never returns and always throws.
   * @throws {ConflictException} Prisma known error `P2002` (unique constraint violation).
   * @throws {BadRequestException} Prisma known error `P2003`, Prisma validation errors, and other unknown known Prisma codes.
   * @throws {NotFoundException} Prisma known error `P2025` (record not found).
   * @throws {ServiceUnavailableException} Prisma client initialization failures.
   * @throws {InternalServerErrorException} Prisma Rust panic errors or unknown unexpected errors.
   */
  handleError(error: any, operation: string): never {
    this.logger.error(
      `Prisma error during ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ConflictException('Unique constraint failed.');
        case 'P2003':
          throw new BadRequestException('Foreign key constraint failed.');
        // TODO (quality): Prisma error code P2025 ("record not found") is currently mapped to NotFoundException, which is correct, but the comment above the case says BadRequestException - verify the mapping is intentional.
        case 'P2025':
          throw new NotFoundException('Requested record was not found.');
        default:
          throw new BadRequestException(
            `Database operation failed with code ${error.code}.`,
          );
      }
    }

    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new BadRequestException('Invalid database request payload.');
    }

    if (error instanceof Prisma.PrismaClientInitializationError) {
      throw new ServiceUnavailableException('Database initialization failed.');
    }

    if (error instanceof Prisma.PrismaClientRustPanicError) {
      throw new InternalServerErrorException(
        'Critical database engine failure.',
      );
    }

    throw new InternalServerErrorException(
      'Unexpected database error occurred.',
    );
  }
}
