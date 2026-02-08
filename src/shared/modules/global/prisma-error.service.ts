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

@Injectable()
export class PrismaErrorService {
  private readonly logger = LoggerService.forRoot('PrismaErrorService');

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
