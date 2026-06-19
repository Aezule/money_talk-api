import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // bufferLogs: garde les logs de démarrage tant que le logger pino n'est pas prêt.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('The Money Talks API description')
    .setVersion('1.0')
    .addTag('money-talks')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

try {
  await bootstrap();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
