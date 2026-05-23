import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class ChangeCategoriesService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(organizationId?: string) {
    const cacheKey = this.cache.key('changes', 'categories', organizationId || 'all');

    return this.cache.wrap(cacheKey, async () => {
      const where: any = {};
      if (organizationId) {
        where.organizationId = organizationId;
      }

      return this.prisma.changeCategory.findMany({
        where,
        include: {
          _count: {
            select: { changes: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }, 'long');
  }

  async findOne(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const category = await this.prisma.changeCategory.findFirst({
      where,
      include: {
        _count: {
          select: { changes: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Change category not found');
    }

    return category;
  }

  async create(data: { name: string; description?: string; sortOrder?: number }, organizationId?: string) {
    const result = await this.prisma.changeCategory.create({
      data: {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder || 0,
        organizationId,
      },
      include: {
        _count: {
          select: { changes: true },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(organizationId);
    return result;
  }

  async update(id: string, data: { name?: string; description?: string; sortOrder?: number; isActive?: boolean }, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const existing = await this.prisma.changeCategory.findFirst({ where });
    if (!existing) {
      throw new NotFoundException('Change category not found');
    }

    const result = await this.prisma.changeCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      include: {
        _count: {
          select: { changes: true },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(organizationId);
    return result;
  }

  async delete(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const existing = await this.prisma.changeCategory.findFirst({ where });
    if (!existing) {
      throw new NotFoundException('Change category not found');
    }

    // Check if category has changes
    const changeCount = await this.prisma.changeRequest.count({
      where: { changeCategoryId: id },
    });

    if (changeCount > 0) {
      throw new Error('Cannot delete category with associated change requests');
    }

    const result = await this.prisma.changeCategory.delete({ where: { id } });

    // Invalidate cache
    await this.invalidateCache(organizationId);
    return result;
  }

  private async invalidateCache(organizationId?: string): Promise<void> {
    if (organizationId) {
      await this.cache.del(this.cache.key('changes', 'categories', organizationId));
    }
    await this.cache.del(this.cache.key('changes', 'categories', 'all'));
  }
}