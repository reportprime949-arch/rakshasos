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
    origin: [
      'https://rakshasos.vercel.app',
      'https://rakshasos-citizen.vercel.app',
      'https://rakshasos-officer.vercel.app',
      'https://rakshasos-admin.vercel.app',
      'https://rakshasos-backend.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 RakshaSOS Backend secured and running on: http://localhost:${port}`);
}
bootstrap();

