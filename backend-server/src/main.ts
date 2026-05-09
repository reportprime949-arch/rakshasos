import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const logger = new Logger('RakshaSOS-Main');
  const app = await NestFactory.create(AppModule);
  
  // STEP 3 — ENABLE GLOBAL CORS
  app.enableCors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*',
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Trust proxy for Render deployment (correctly handle rate limiting)
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);

  const port = process.env.PORT || 5000;
  await app.listen(port);
  logger.log(`🚀 RakshaSOS Backend secured and running on: http://localhost:${port}`);
}
bootstrap();

