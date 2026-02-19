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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.set('query parser', 'extended');

  const logger = LoggerService.forRoot('Bootstrap');
  const apiPrefix = process.env.API_PREFIX || 'v6';

  app.setGlobalPrefix(apiPrefix);

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

  app.use((_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = ((body?: any): Response => {
      originalJson(serializeBigInt(body));
      return res;
    }) as Response['json'];
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
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

  app.useBodyParser('json', { limit: '15mb' });
  app.useBodyParser('urlencoded', { limit: '15mb', extended: true });

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

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
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

  SwaggerModule.setup(`/${apiPrefix}/projects/api-docs`, app, swaggerDocument);
  SwaggerModule.setup(`/${apiPrefix}/projects-api-docs`, app, swaggerDocument);

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
