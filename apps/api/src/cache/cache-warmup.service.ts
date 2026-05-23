import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { PrismaService } from '../common/prisma.service';

/**
 * Cache Warming Service
 *
 * Preloads frequently accessed data into Redis cache on application startup.
 * This reduces initial page load latency and database load.
 */
@Injectable()
export class CacheWarmupService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmupService.name);

  constructor(
    private cache: CacheService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Only warm cache if Redis caching is enabled
    if (!this.cache.isEnabled()) {
      this.logger.log('[CacheWarmup] Redis caching disabled, skipping warmup');
      return;
    }

    this.logger.log('[CacheWarmup] Starting cache warmup...');

    try {
      // Warm up multiple cache entries in parallel
      await Promise.all([
        this.warmCategories(),
        this.warmTeams(),
        this.warmArticleCategories(),
        this.warmTags(),
        this.warmServiceCategories(),
      ]);

      this.logger.log('[CacheWarmup] Cache warmup completed successfully');
    } catch (error) {
      this.logger.warn('[CacheWarmup] Cache warmup failed, continuing without cache warming:', error);
    }
  }

  private async warmCategories(): Promise<void> {
    const key = this.cache.key('categories', 'list');
    const data = await this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        parent: { select: { id: true, name: true } },
        defaultTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    await this.cache.set(key, data, 'long');
    this.logger.debug(`[CacheWarmup] Warmed categories (${data.length} items)`);
  }

  private async warmTeams(): Promise<void> {
    const key = this.cache.key('teams', 'list');
    const data = await this.prisma.team.findMany({
      where: { isActive: true },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    await this.cache.set(key, data, 'long');
    this.logger.debug(`[CacheWarmup] Warmed teams (${data.length} items)`);
  }

  private async warmArticleCategories(): Promise<void> {
    const key = this.cache.key('kb', 'categories');
    const data = await this.prisma.articleCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    await this.cache.set(key, data, 'long');
    this.logger.debug(`[CacheWarmup] Warmed article categories (${data.length} items)`);
  }

  private async warmTags(): Promise<void> {
    const key = this.cache.key('kb', 'tags');
    const data = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
    await this.cache.set(key, data, 'long');
    this.logger.debug(`[CacheWarmup] Warmed tags (${data.length} items)`);
  }

  private async warmServiceCategories(): Promise<void> {
    const key = this.cache.key('catalog', 'categories');
    const data = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    await this.cache.set(key, data, 'long');
    this.logger.debug(`[CacheWarmup] Warmed service categories (${data.length} items)`);
  }
}
