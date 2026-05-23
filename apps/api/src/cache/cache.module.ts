import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheService } from './cache.service';
import { HttpCacheInterceptor } from './http-cache.interceptor';
import { PrismaModule } from '../common/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: 'CACHE_CONFIG',
      useFactory: (config: ConfigService) => ({
        enabled: config.get('REDIS_CACHE_ENABLED', 'true') === 'true',
        ttl: {
          short: parseInt(config.get('REDIS_CACHE_TTL_SHORT', '30000'), 10), // 30s
          medium: parseInt(config.get('REDIS_CACHE_TTL_MEDIUM', '300000'), 10), // 5min
          long: parseInt(config.get('REDIS_CACHE_TTL_LONG', '900000'), 10), // 15min
          veryLong: parseInt(config.get('REDIS_CACHE_TTL_VERY_LONG', '3600000'), 10), // 1hr
        },
      }),
      inject: [ConfigService],
    },
    CacheService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpCacheInterceptor,
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
