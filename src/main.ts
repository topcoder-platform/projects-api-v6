/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cors from 'cors';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfig } from 'config/config';

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  app.setGlobalPrefix(AppConfig.prefix);

  // Set global validator
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // CORS related settings
  const corsConfig: cors.CorsOptions = {
    allowedHeaders:
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin, Access-Control-Allow-Headers,currentOrg,overrideOrg,x-atlassian-cloud-id,x-api-key,x-orgid',
    credentials: true,
    origin: process.env.CORS_ALLOWED_ORIGIN
      ? new RegExp(process.env.CORS_ALLOWED_ORIGIN)
      : ['http://localhost:3000', /\.localhost:3000$/],
    methods: 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  };
  app.use(cors(corsConfig));

  // Add swagger docs module
  const config = new DocumentBuilder()
    .setTitle('Projects API')
    .setDescription('TopCoder Projects API v6 Document')
    .setVersion('v6')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter JWT access token',
      in: 'header',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${AppConfig.prefix}/projects/api-docs`, app, document);

  await app.listen(AppConfig.port);
}
bootstrap(); // eslint-disable-line @typescript-eslint/no-floating-promises
