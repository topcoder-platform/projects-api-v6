import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfig } from 'config/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix
  app.setGlobalPrefix(AppConfig.prefix);

  // Set global validator
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  // Add swagger docs module
  const config = new DocumentBuilder()
    .setTitle('Projects API')
    .setDescription('TopCoder Projects API v6 Document')
    .setVersion('v6')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api-docs', app, document);

  await app.listen(AppConfig.port);
}
bootstrap();
