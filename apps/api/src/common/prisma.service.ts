import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Performance configuration for stress testing
const SLOW_QUERY_THRESHOLD_MS = 1000; // Log queries slower than 1 second

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  async onModuleInit() {
    // Configure logging for slow queries in non-production
    // Use Prisma extension for query logging
    if (process.env.NODE_ENV !== 'production') {
      const originalQuery = this.$queryRaw.bind(this);
      this.$use(async (params, next) => {
        const start = Date.now();
        const result = await next(params);
        const duration = Date.now() - start;

        if (duration >= SLOW_QUERY_THRESHOLD_MS && params.model) {
          this.logger.warn(
            `SLOW QUERY (${duration}ms) on ${params.model}.${params.action}: ${JSON.stringify(params.args)}`,
          );
        }
        return result;
      });
    }

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Soft delete helper
  async softDelete<T extends { delete: () => T }>(
    model: T,
  ): Promise<T> {
    return model.delete();
  }
}
