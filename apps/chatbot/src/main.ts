import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Add health check endpoint using Express directly
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (req: express.Request, res: express.Response) => {
    res.json({ status: 'ok', service: 'chatbot', timestamp: new Date().toISOString() });
  });

  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Increase JSON body parser limit for chat messages
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Enable response compression
  app.use(compression({
    level: 6,
    threshold: 1024,
  }));

  // Security headers
  app.use(helmet());

  // Parse cookies
  app.use(cookieParser());

  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || origin === 'null' || origin === 'undefined') {
        return callback(null, true);
      }

      if (isProduction) {
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        console.log('CORS blocked origin (production):', origin);
        return callback(new Error('Not allowed by CORS'));
      }

      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-organization-id'],
    exposedHeaders: ['set-cookie'],
  });

  // No API versioning for chatbot service (standalone service)
  // app.enableVersioning({
  //   type: VersioningType.URI,
  //   defaultVersion: '1',
  //   prefix: 'v',
  // });

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

  // Swagger documentation (non-production only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Helix Chatbot Service')
      .setDescription('AI Chatbot Service for Helix Helpdesk')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('chatbot', 'Chatbot sessions and messaging')
      .build();

    const document = SwaggerModule.createDocument(app as unknown as INestApplication, config);
    SwaggerModule.setup('api/docs', app as unknown as INestApplication, document);
  }

  // Default port 3001 for chatbot service
  const port = process.env.CHATBOT_PORT || 3001;
  await app.listen(port);

  const logger = new Logger();
  logger.log(`Chatbot Service running on: http://localhost:${port}`);
  logger.log(`API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`Endpoints:`);
  logger.log(`  - POST /chatbot/sessions     - Create session`);
  logger.log(`  - GET  /chatbot/sessions/:id - Get session`);
  logger.log(`  - POST /chatbot/sessions/:id/messages - Send message`);
}

bootstrap();