import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheAdapter } from '@inotechxyz/protected-license';

/**
 * Redis-based cache adapter for chatbot service
 * Provides distributed caching with TTL support
 */
@Injectable()
export class RedisCacheService implements CacheAdapter, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RedisCacheService');
  private client: Redis;
  private isConnected = false;

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn('Redis connection failed, falling back to no-cache mode');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
      this.isConnected = true;
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn('Redis connection failed during init, continuing without cache');
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      // Ignore errors on shutdown
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.warn(`Cache get error for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
      this.logger.debug(`Cache set: ${key} (expires in ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.warn(`Cache set error for key ${key}: ${error}`);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.client.del(key);
      this.logger.debug(`Cache deleted: ${key}`);
    } catch (error) {
      this.logger.warn(`Cache del error for key ${key}: ${error}`);
    }
  }

  /**
   * Get Redis client for direct access (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  isAvailable(): boolean {
    return this.isConnected;
  }
}