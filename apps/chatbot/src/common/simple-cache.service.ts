import { Injectable, Logger } from '@nestjs/common';
import { CacheAdapter } from '@inotechxyz/protected-license';

/**
 * Simple in-memory cache adapter for chatbot service
 * For production, consider using Redis for distributed caching
 */
@Injectable()
export class SimpleCacheService implements CacheAdapter {
  private readonly logger = new Logger('SimpleCacheService');
  private cache = new Map<string, { value: any; expiresAt: number }>();

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.cleanup();
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
    this.logger.debug(`Cache set: ${key} (expires in ${ttlSeconds}s)`);
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
}