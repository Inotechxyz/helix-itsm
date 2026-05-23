import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';

export interface CacheConfig {
  enabled: boolean;
  ttl: {
    short: number;
    medium: number;
    long: number;
    veryLong: number;
  };
}

export type CacheTTL = 'short' | 'medium' | 'long' | 'veryLong';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private redis: Redis | null = null;
  private readonly config: CacheConfig;
  private readonly logger = console;

  constructor(@Inject('CACHE_CONFIG') config: CacheConfig) {
    this.config = config;

    if (this.config.enabled) {
      this.initRedis();
    }
  }

  private initRedis(): void {
    try {
      const Redis = require('ioredis');
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      const redis = new (Redis as any)(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            this.logger.warn('[Cache] Redis connection failed, caching disabled');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      redis.on('error', (err: Error) => {
        this.logger.warn(`[Cache] Redis error: ${err.message}`);
      });

      redis.connect().catch((err: Error) => {
        this.logger.warn(`[Cache] Could not connect to Redis: ${err.message}`);
      });

      // Assign after successful setup
      this.redis = redis;

      this.logger.log('[Cache] Redis cache initialized');
    } catch (error) {
      this.logger.warn('[Cache] Failed to initialize Redis:', error);
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && this.redis !== null;
  }

  private getTTL(ttl: CacheTTL | number): number {
    if (typeof ttl === 'string') {
      return this.config.ttl[ttl] || this.config.ttl.medium;
    }
    return ttl;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const data = await this.redis!.get(key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error) {
      this.logger.warn(`[Cache] Get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: CacheTTL | number = 'medium'): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      const ttlMs = this.getTTL(ttl);
      await this.redis!.setex(key, Math.floor(ttlMs / 1000), JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`[Cache] Set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await this.redis!.del(key);
    } catch (error) {
      this.logger.warn(`[Cache] Del error for key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<number> {
    if (!this.isEnabled()) {
      return 0;
    }

    try {
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        return await this.redis!.del(...keys);
      }
      return 0;
    } catch (error) {
      this.logger.warn(`[Cache] DelPattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const result = await this.redis!.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.warn(`[Cache] Exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Cache-aside pattern - get from cache or fetch and cache
   */
  async wrap<T>(key: string, fetchFn: () => Promise<T>, ttl: CacheTTL | number = 'medium'): Promise<T> {
    if (!this.isEnabled()) {
      return fetchFn();
    }

    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Generate a cache key with namespace
   */
  key(namespace: string, ...parts: string[]): string {
    return `cache:${namespace}:${parts.join(':')}`;
  }

  /**
   * Acquire a lock for cache stampede protection
   * Returns a function to release the lock when done
   */
  async acquireLock(key: string, ttlMs: number = 30000): Promise<() => Promise<void>> {
    const lockKey = `lock:${key}`;
    const locked = await this.redis?.setnx(lockKey, '1');

    if (!locked) {
      // Lock already exists, wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.acquireLock(key, ttlMs);
    }

    // Set expiry on lock
    await this.redis?.pexpire(lockKey, ttlMs);

    // Return release function
    return async () => {
      await this.del(lockKey);
    };
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.redis?.status === 'ready';
  }
}