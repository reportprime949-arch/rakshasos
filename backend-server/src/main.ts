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
  
  // PERFORMANCE & SECURITY MIDDLEWARE
  app.use(helmet());
  app.use(require('compression')());
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per 15 mins
    message: 'Security threshold reached. Please try again later.',
  }));

  // STEP 3 — ENABLE STRICT CORS
  const allowedOrigins = [
    'http://localhost:3000', // Citizen Legacy
    'http://localhost:3003', // Citizen Current
    'http://localhost:3001', // Officer
    'http://localhost:3002', // Admin
    process.env.FRONTEND_URL, // Production
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
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

