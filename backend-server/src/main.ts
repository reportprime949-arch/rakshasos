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
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Security threshold reached. Please try again later.',
  }));

  // PRODUCTION CORS — must match gateway CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',

    'https://rakshasos.vercel.app',
    'https://rakshasos-3tro.vercel.app',

    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`🚫 CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Trust proxy for Render deployment
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);

  // ROOT HEALTH ENDPOINT — required for Render health checks
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  httpAdapter.get('/', (req: any, res: any) => {
    res.status(200).json({ status: 'ok', service: 'RakshaSOS Backend', timestamp: new Date().toISOString() });
  });

  // Render requires binding to 0.0.0.0
  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 RakshaSOS Backend running on port ${port} (0.0.0.0)`);
  logger.log(`📡 Allowed origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
