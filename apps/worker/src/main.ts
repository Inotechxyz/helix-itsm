import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { EmailProcessor } from './processors/email.processor';
import { EmailService } from './services/email.service';
import { MultiOrgEmailPollerService } from './services/multi-org-email-poller.service';
import { SlaService } from './services/sla.service';
import { logger, writeStartupLog } from './common/logger';
import * as path from 'path';
import * as fs from 'fs';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: () => {
        // Support both REDIS_URL (full URL) and separate REDIS_HOST/REDIS_PORT
        let redisConfig: any;
        if (process.env.REDIS_URL) {
          // Parse REDIS_URL like redis://localhost:6379
          const url = new URL(process.env.REDIS_URL);
          redisConfig = {
            host: url.hostname || 'localhost',
            port: parseInt(url.port || '6379'),
            password: url.password || undefined,
          };
        } else {
          redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
          };
        }
        return { redis: redisConfig };
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    ScheduleModule.forRoot(),
  ],
  providers: [
    PrismaService,
    EmailService,
    EmailProcessor,
    MultiOrgEmailPollerService,
    SlaService,
  ],
})
export class WorkerModule {}

async function bootstrap() {
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Write startup log to file
  const startupMsg = `Helix Worker started at ${new Date().toISOString()}`;
  writeStartupLog(startupMsg);

  // Log to winston
  logger.info('Worker started');

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
