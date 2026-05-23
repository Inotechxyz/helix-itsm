import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(organizationId?: string) {
    const cacheKey = this.cache.key('categories', 'list', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { isActive: true };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      return this.prisma.category.findMany({
        where,
        include: {
          parent: {
            select: { id: true, name: true },
          },
          defaultTeam: {
            select: { id: true, name: true },
          },
          _count: {
            select: { tickets: true, children: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }, 'long');
  }

  async findOne(id: string, organizationId?: string) {
    const cacheKey = this.cache.key('categories', id, organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { id };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const category = await this.prisma.category.findFirst({
        where,
        include: {
          parent: true,
          defaultTeam: true,
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: { tickets: true },
          },
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category;
    }, 'medium');
  }

  async findTree(organizationId?: string) {
    const cacheKey = this.cache.key('categories', 'tree', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { isActive: true };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const categories = await this.prisma.category.findMany({
        where,
        include: {
          defaultTeam: {
            select: { id: true, name: true },
          },
          _count: {
            select: { tickets: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      // Build tree structure
      const map = new Map<string, any>();
      categories.forEach((cat) => {
        map.set(cat.id, { ...cat, children: [] });
      });

      const roots: any[] = [];
      map.forEach((category) => {
        if (category.parentId) {
          const parent = map.get(category.parentId);
          if (parent) {
            parent.children.push(category);
          }
        } else {
          roots.push(category);
        }
      });

      return roots;
    }, 'long');
  }

  async create(data: {
    name: string;
    description?: string;
    parentId?: string;
    defaultTeamId?: string;
    sortOrder?: number;
  }, organizationId?: string) {
    const result = await this.prisma.category.create({
      data: {
        ...data,
        organizationId,
      },
      include: {
        parent: { select: { id: true, name: true } },
        defaultTeam: { select: { id: true, name: true } },
      },
    });

    // Invalidate cache
    await this.invalidateCache(organizationId);

    return result;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    defaultTeamId?: string;
    sortOrder?: number;
    isActive?: boolean;
  }, organizationId?: string) {
    await this.findOne(id, organizationId);
    const result = await this.prisma.category.update({
      where: { id },
      data,
      include: {
        parent: { select: { id: true, name: true } },
        defaultTeam: { select: { id: true, name: true } },
      },
    });

    // Invalidate cache
    await this.cache.del(this.cache.key('categories', id));
    await this.invalidateCache(organizationId);

    return result;
  }

  async delete(id: string, organizationId?: string) {
    await this.findOne(id, organizationId);
    const result = await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate cache
    await this.cache.del(this.cache.key('categories', id));
    await this.invalidateCache(organizationId);

    return result;
  }

  private async invalidateCache(organizationId?: string): Promise<void> {
    await this.cache.del(this.cache.key('categories', 'list'));
    await this.cache.del(this.cache.key('categories', 'tree'));
    if (organizationId) {
      await this.cache.del(this.cache.key('categories', 'list', organizationId));
      await this.cache.del(this.cache.key('categories', 'tree', organizationId));
    }
  }
}
