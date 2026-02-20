/**
 * NestJS application bootstrap entry point for the Topcoder Project API v6.
 *
 * Responsibilities:
 * - Configures CORS.
 * - Registers global middleware (BigInt serialiser and HTTP request/response logger).
 * - Applies a global ValidationPipe.
 * - Builds and serves Swagger documentation.
 * - Registers process-level error handlers.
 *
 * Environment variables consumed:
 * - API_PREFIX
 * - PORT
 * - CORS_ALLOWED_ORIGIN
 * - HEALTH_CHECK_TIMEOUT
 *
 * Lifecycle:
 * - Called once by Node.js at startup.
 * - Loads all other modules through AppModule.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cors from 'cors';
import { NextFunction, Request, Response } from 'express';
import { ApiModule } from './api/api.module';
import {
  EVENT_SWAGGER_EXAMPLES,
  EVENT_SWAGGER_MODELS,
} from './api/metadata/metadata.swagger';
import { WorkStreamModule } from './api/workstream/workstream.module';
import { AppModule } from './app.module';
import { enrichSwaggerAuthDocumentation } from './shared/utils/swagger.utils';
import { LoggerService } from './shared/modules/global/logger.service';

// TODO (quality): Move serializeBigInt to src/shared/utils/serialization.utils.ts
/**
 * Recursively serializes BigInt values so JSON responses can be emitted safely.
 *
 * @param value - Any value that may contain BigInt scalars at any depth.
 * @returns The same structure with every BigInt replaced by its decimal string representation.
 * @remarks Recursively handles plain objects and arrays. Needed because JSON.stringify throws on BigInt.
 */
function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeBigInt(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        serializeBigInt(entry),
      ]),
    );
  }

  return value;
}

/**
 * Bootstraps the Topcoder Project API v6 HTTP server.
 *
 * @returns Promise<void> - resolves when the HTTP server is listening.
 * @throws Will log and surface any NestJS factory or listen errors via the unhandledRejection handler.
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.set('query parser', 'extended');

  const logger = LoggerService.forRoot('Bootstrap');
  const apiPrefix = process.env.API_PREFIX || 'v6';

  app.setGlobalPrefix(apiPrefix);

  // CORS origin logic: static allow-list plus Topcoder domain patterns.
  const topcoderOriginPatterns = [
    /^https?:\/\/([\w-]+\.)*topcoder\.com(?::\d+)?$/i,
    /^https?:\/\/([\w-]+\.)*topcoder-dev\.com(?::\d+)?$/i,
  ];

  const allowList: (string | RegExp)[] = [
    'http://localhost:3000',
    /\.localhost:3000$/,
  ];

  if (process.env.CORS_ALLOWED_ORIGIN) {
    try {
      // TODO (security): Compiling an untrusted env-var string directly into a RegExp is a ReDoS risk. Validate or escape the value before use, or restrict it to a plain string comparison.
      allowList.push(new RegExp(process.env.CORS_ALLOWED_ORIGIN));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn(
        `Invalid CORS_ALLOWED_ORIGIN pattern (${process.env.CORS_ALLOWED_ORIGIN}): ${errorMessage}`,
      );
    }
  }

  const isAllowedOrigin = (origin: string): boolean => {
    if (
      allowList.some((allowedOrigin) => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return allowedOrigin === origin;
      })
    ) {
      return true;
    }

    return topcoderOriginPatterns.some((pattern) => pattern.test(origin));
  };

  const corsConfig: cors.CorsOptions = {
    allowedHeaders:
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin, Access-Control-Allow-Headers,currentOrg,overrideOrg,x-atlassian-cloud-id,x-api-key,x-orgid',
    credentials: true,
    methods: 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        // Keep a permissive fallback for non-browser requests so cached variants
        // do not drop CORS headers for subsequent browser calls.
        // TODO (security): Returning '*' for requests with no Origin header allows any cross-origin server-side client to receive CORS headers. Consider returning false or omitting the header for server-to-server calls.
        callback(null, '*');
        return;
      }

      if (isAllowedOrigin(requestOrigin)) {
        callback(null, requestOrigin);
        return;
      }

      callback(null, false);
    },
  };

  app.use(cors(corsConfig));

  // BigInt serialiser middleware.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = ((body?: any): Response => {
      originalJson(serializeBigInt(body));
      return res;
    }) as Response['json'];
    next();
  });

  // HTTP request/response logger middleware.
  app.use((req: Request, res: Response, next: NextFunction) => {
    // TODO (quality): A new LoggerService instance is created on every HTTP request. Hoist the logger to module scope or inject it once at bootstrap time.
    const requestLogger = LoggerService.forRoot('HttpRequest');
    const startedAt = Date.now();

    requestLogger.log({
      type: 'request',
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const originalSend = res.send.bind(res);
    res.send = ((body?: any): Response => {
      const responseTimeMs = Date.now() - startedAt;
      const statusCode = res.statusCode;

      requestLogger.log({
        type: 'response',
        method: req.method,
        url: req.originalUrl,
        statusCode,
        responseTime: `${responseTimeMs}ms`,
      });

      if (statusCode >= 500) {
        requestLogger.error({
          message: 'Server error response',
          method: req.method,
          url: req.originalUrl,
          statusCode,
        });
      }

      return originalSend(body) as Response;
    }) as Response['send'];

    next();
  });

  // Body-parser limits.
  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { limit: '15mb', extended: true });

  // Global ValidationPipe.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Topcoder Project Service')
    .setDescription(
      `
Topcoder Project API Documentation

Authentication

The API supports two authentication methods:

User Token (JWT)
- Standard user authentication with role-based authorization.
- Provide the JWT in the Authorization header as Bearer token.

Machine-to-Machine (M2M) Token
- Service-to-service authentication with scope-based authorization.
- M2M tokens must include required scopes for protected endpoints.

Development token example:

curl --request POST \\
  --url https://topcoder-dev.auth0.com/oauth/token \\
  --header 'content-type: application/json' \\
  --data '{"client_id":"your-client-id","client_secret":"your-client-secret","audience":"https://m2m.topcoder-dev.com/","grant_type":"client_credentials"}'
      `,
    )
    .setVersion('1.0')
    .addTag('Projects')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT access token',
      in: 'header',
    })
    .build();

  // Swagger setup.
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    // TODO (quality): WorkStreamModule is included in the Swagger document but is not imported in ApiModule. Either add WorkStreamModule to ApiModule's imports array, or remove it from the Swagger include list to avoid documentation drift.
    include: [ApiModule, WorkStreamModule],
    deepScanRoutes: true,
    extraModels: [...EVENT_SWAGGER_MODELS],
  });

  swaggerDocument.components = swaggerDocument.components || {};
  swaggerDocument.components.examples = {
    ...(swaggerDocument.components.examples || {}),
    ...EVENT_SWAGGER_EXAMPLES,
  };

  enrichSwaggerAuthDocumentation(swaggerDocument);

  // TODO (security): Swagger UI is publicly accessible with no authentication. In production, restrict access by IP, add HTTP Basic auth, or disable entirely via an env flag.
  SwaggerModule.setup(`/${apiPrefix}/projects/api-docs`, app, swaggerDocument);
  // TODO (security): Swagger UI is publicly accessible with no authentication. In production, restrict access by IP, add HTTP Basic auth, or disable entirely via an env flag.
  // TODO (quality): Duplicate Swagger mount. Consolidate to a single canonical path (e.g. /${apiPrefix}/projects/api-docs) and remove the second mount.
  SwaggerModule.setup(`/${apiPrefix}/projects-api-docs`, app, swaggerDocument);

  // Process error handlers.
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      {
        message: 'Unhandled Promise Rejection',
        promiseType: typeof promise,
      },
      reason instanceof Error ? reason.stack : String(reason),
    );
  });

  process.on('uncaughtException', (error: Error) => {
    logger.error(`Uncaught Exception: ${error.message}`, error.stack);
  });

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  logger.log(`Server started on port ${port}`);
}

void bootstrap();
