import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { DatabaseAdapter, CacheAdapter } from '@inotechxyz/protected-license';

/**
 * Prisma-based Database Adapter for @inotechxyz/protected-license
 */
@Injectable()
export class LicenseDatabaseAdapter implements DatabaseAdapter {
  constructor(private prisma: PrismaService) {}

  async findOrganization(id: string): Promise<{ slug: string; licenseToken: string | null } | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { slug: true, licenseToken: true },
    });
    return org;
  }
}

/**
 * Redis-based Cache Adapter for @inotechxyz/protected-license
 */
@Injectable()
export class LicenseCacheAdapter implements CacheAdapter {
  constructor(private cache: CacheService) {}

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    // Convert seconds to milliseconds for CacheService
    const ttlMs = ttlSeconds * 1000;
    await this.cache.set(key, value, ttlMs);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }
}