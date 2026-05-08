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
  
  // Security Hardening
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    }),
  );

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
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

