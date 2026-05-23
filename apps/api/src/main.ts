import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';
import { logger, writeStartupLog } from './common/logger';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Increase JSON body parser limit for file uploads (base64 encoded attachments)
  // Default is 100kb, we need more for large attachments (up to 50MB file = ~67MB base64)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Enable response compression for better performance
  app.use(compression({
    level: 6, // Balanced compression level
    threshold: 1024, // Only compress responses > 1KB
  }));

  // Security headers with Helmet (includes x-powered-by removal)
  app.use(helmet());

  // Parse cookies for cookie-based authentication
  app.use(cookieParser());

  // Enable CORS with strict configuration
  // CORS origins are configurable via ALLOWED_ORIGINS environment variable
  // In development: defaults to localhost origins if not specified
  // In production: must specify allowed origins via ALLOWED_ORIGINS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, Azure AD form_post, etc.)
      // Also allow "null" origin string which can occur in certain browser scenarios
      if (!origin || origin === 'null' || origin === 'undefined') {
        return callback(null, true);
      }

      // In production, only allow defined origins from ALLOWED_ORIGINS env var
      if (isProduction) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.log('CORS blocked origin (production):', origin);
        return callback(new Error('Not allowed by CORS'));
      }

      // In development, allow localhost origins
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      // Also allow origins specified in ALLOWED_ORIGINS even in development
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-INTERNAL-API-KEY'],
    exposedHeaders: ['set-cookie'],
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Only enable Swagger documentation in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Helix Helpdesk API')
      .setDescription('ITSM Platform API for managing tickets, knowledge base, and service catalog')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('teams', 'Team management')
      .addTag('tickets', 'Ticket management')
      .addTag('categories', 'Category management')
      .addTag('knowledge-base', 'Knowledge base articles')
      .addTag('service-catalog', 'Service catalog and requests')
      .addTag('reports', 'Analytics and reporting')
      .build();

    const document = SwaggerModule.createDocument(app as unknown as INestApplication, config);
    SwaggerModule.setup('api/docs', app as unknown as INestApplication, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Write startup log to file
  const startupMsg = `Helix API started on port ${port} at ${new Date().toISOString()}`;
  writeStartupLog(startupMsg);

  // Use winston logger for console output and file logging
  const nestLogger = new Logger();
  nestLogger.log(`Application is running on: http://localhost:${port}`);
  nestLogger.log(`API Documentation: http://localhost:${port}/api/docs`);

  // Also write to winston logger
  logger.info(`Application started on port ${port}`);
  logger.info(`API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
