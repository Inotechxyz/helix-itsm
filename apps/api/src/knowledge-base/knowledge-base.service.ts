import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CacheService } from '../cache/cache.service';
import { EmbeddingService } from './embedding.service';
import { Prisma } from '@prisma/client';

const ArticleStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private embeddingService?: EmbeddingService,
  ) {}

  // Articles
  async findAllArticles(options: {
    status?: 'draft' | 'published' | 'archived';
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    organizationId?: string;
    userId?: string;
    userRole?: string;
  }) {
    const { status, categoryId, search, page = 1, limit = 20, organizationId, userId, userRole } = options;

    const cacheKey = this.cache.key('kb', 'articles', JSON.stringify({ status, categoryId, search, page, limit, organizationId, userId, userRole }));

    return this.cache.wrap(cacheKey, async () => {
      const where: Prisma.ArticleWhereInput = {};

      // Determine which statuses to include based on user role
      const isAdmin = userRole === 'superadmin' || userRole === 'orgadmin' || userRole === 'manager';

      // Organization filter: show global articles (null) + org-specific articles
      if (organizationId) {
        where.OR = [
          { organizationId: organizationId },
          { organizationId: null }, // Global articles shared across all orgs
        ];
      }

      if (status) {
        // Specific status requested
        where.status = status;
      } else {
        // No status filter - determine what to show
        if (isAdmin) {
          // Admins/managers see all statuses (draft, published, archived)
          where.status = {
            in: [ArticleStatus.PUBLISHED, ArticleStatus.DRAFT, ArticleStatus.ARCHIVED],
          };
        } else if (userId) {
          // Regular users see published + their own drafts
          where.OR = [
            { status: ArticleStatus.PUBLISHED },
            { status: ArticleStatus.DRAFT, createdById: userId },
          ];
        } else {
          // No auth context - only published
          where.status = ArticleStatus.PUBLISHED;
        }
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (search) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
            ],
          },
        ];
      }

      const articles = await this.prisma.article.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const total = await this.prisma.article.count({ where });

      return {
        items: articles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }, 'medium');
  }

  async findArticleBySlug(slug: string, organizationId: string, userId?: string, userRole?: string) {
    const isAdmin = userRole === 'superadmin' || userRole === 'orgadmin' || userRole === 'manager';

    const article = await this.prisma.article.findFirst({
      where: {
        slug,
        organizationId, // Always filter by organization
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Admins can view any article, regular users can only view published
    if (!article || (!isAdmin && article.status !== ArticleStatus.PUBLISHED)) {
      throw new NotFoundException('Article not found');
    }

    // For published articles only - increment view count
    if (article.status === ArticleStatus.PUBLISHED) {
      // Increment view count (write operation, don't cache)
      await this.prisma.article.update({
        where: { id: article.id },
        data: { views: { increment: 1 } },
      });

      await this.prisma.articleView.create({
        data: { articleId: article.id },
      });
    }

    // Return with tags mapped to just the tag objects
    const { tags: articleTags, ...rest } = article;
    return {
      ...rest,
      tags: articleTags.map((t: { tag: unknown }) => t.tag),
    };
  }

  async createArticle(data: {
    title: string;
    content: string;
    summary?: string;
    categoryId: string;
    metaTitle?: string;
    metaDescription?: string;
    tagIds?: string[];
  }, userId: string, organizationId?: string) {
    const slug = this.generateSlug(data.title);

    const result = await this.prisma.article.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        summary: data.summary,
        categoryId: data.categoryId,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        createdById: userId,
        status: ArticleStatus.DRAFT,
        organizationId,
        tags: data.tagIds ? {
          create: data.tagIds.map((tagId) => ({ tagId })),
        } : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    await this.invalidateCache(organizationId);
    return result;
  }

  async updateArticle(id: string, data: {
    title?: string;
    content?: string;
    summary?: string;
    categoryId?: string;
    metaTitle?: string;
    metaDescription?: string;
    tagIds?: string[];
  }, userId: string, organizationId?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');

    // Check if content-affecting fields changed
    const contentChanged =
      (data.title && data.title !== article.title) ||
      (data.content && data.content !== article.content) ||
      (data.summary !== undefined && data.summary !== article.summary);

    const updateData: Prisma.ArticleUpdateInput = {
      title: data.title,
      content: data.content,
      summary: data.summary,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
    };

    if (data.categoryId) {
      updateData.category = { connect: { id: data.categoryId } };
    }

    if (data.title && data.title !== article.title) {
      updateData.slug = this.generateSlug(data.title);
    }

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        ...updateData,
        tags: data.tagIds ? {
          deleteMany: {},
          create: data.tagIds.map((tagId) => ({ tagId })),
        } : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    await this.cache.del(this.cache.key('kb', 'article', article.slug));
    await this.invalidateCache(organizationId);

    // Re-generate embedding if article is published and content changed
    if (article.status === ArticleStatus.PUBLISHED && contentChanged) {
      await this.generateArticleEmbedding(id, organizationId);
    }

    return {
      ...updated,
      tags: updated.tags.map((t) => t.tag),
    };
  }

  async publishArticle(id: string, userId: string, organizationId?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const result = await this.prisma.article.update({
      where: { id },
      data: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    // Auto-generate embedding for the published article
    await this.generateArticleEmbedding(id, organizationId);

    await this.invalidateCache(organizationId);
    return result;
  }

  async archiveArticle(id: string, organizationId?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    const result = await this.prisma.article.update({
      where: { id },
      data: {
        status: ArticleStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    // Delete embedding for archived article
    await this.prisma.articleEmbedding.deleteMany({
      where: { articleId: id },
    });

    await this.cache.del(this.cache.key('kb', 'article', article.slug));
    await this.invalidateCache(organizationId);
    return result;
  }

  /**
   * Generate embedding for an article
   */
  async generateArticleEmbedding(articleId: string, organizationId?: string): Promise<void> {
    if (!this.embeddingService) {
      return; // Skip if embedding service not available
    }

    try {
      await this.embeddingService.embedArticle(articleId, organizationId || '');
    } catch (error) {
      // Log but don't fail the publish operation
      console.error(`Failed to generate embedding for article ${articleId}:`, error);
    }
  }

  /**
   * Hybrid search: combines semantic search with keyword search
   */
  async hybridSearch(options: {
    query: string;
    limit?: number;
    organizationId?: string;
  }) {
    const { query, limit = 10, organizationId } = options;
    const results: Array<{ id: string; slug: string; title: string; summary?: string | null; similarity?: number; searchType: 'semantic' | 'keyword' }> = [];

    // 1. Keyword search (always available)
    const keywordResults = await this.prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        organizationId: organizationId || undefined,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { summary: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
      },
      take: limit,
    });

    results.push(...keywordResults.map(r => ({
      ...r,
      searchType: 'keyword' as const,
    })));

    // 2. Semantic search (if embedding service available)
    if (this.embeddingService && organizationId) {
      try {
        const semanticResults = await this.embeddingService.semanticSearch(query, organizationId, limit);

        if (semanticResults.length > 0) {
          const semanticArticleIds = semanticResults.map(r => r.articleId);

          const semanticArticles = await this.prisma.article.findMany({
            where: {
              id: { in: semanticArticleIds },
              status: ArticleStatus.PUBLISHED,
            },
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
            },
          });

          // Merge with similarity scores
          for (const article of semanticArticles) {
            const similarityResult = semanticResults.find(r => r.articleId === article.id);
            results.push({
              ...article,
              similarity: similarityResult?.similarity,
              searchType: 'semantic' as const,
            });
          }
        }
      } catch (error) {
        console.error('Semantic search failed:', error);
        // Continue with keyword results only
      }
    }

    // 3. Remove duplicates, keeping higher similarity scores
    const seen = new Map<string, typeof results[0]>();
    for (const result of results) {
      const existing = seen.get(result.id);
      if (!existing || (result.similarity && result.similarity > (existing.similarity || 0))) {
        seen.set(result.id, result);
      }
    }

    return Array.from(seen.values()).slice(0, limit);
  }

  async submitFeedback(id: string, helpful: boolean, ipAddress?: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');

    const field = helpful ? 'helpfulYes' : 'helpfulNo';
    await this.prisma.article.update({
      where: { id },
      data: { [field]: { increment: 1 } },
    });

    return this.prisma.articleFeedback.create({
      data: {
        articleId: id,
        helpful,
        userIp: ipAddress,
      },
    });
  }

  // Categories
  async findAllCategories(organizationId?: string) {
    const cacheKey = this.cache.key('kb', 'categories', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { isActive: true };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      return this.prisma.articleCategory.findMany({
        where,
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { articles: true, children: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }, 'long');
  }

  /**
   * Get category tree hierarchy for hierarchical display
   */
  async getCategoryTree(organizationId?: string) {
    const categories = await this.findAllCategories(organizationId);

    // Build tree structure
    const categoryMap = new Map<string, any>();
    const roots: any[] = [];

    // First pass: create map with children arrays
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async findCategoryBySlug(slug: string, organizationId?: string) {
    const cacheKey = this.cache.key('kb', 'category', slug, organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = { slug };
      if (organizationId) {
        where.organizationId = organizationId;
      }
      const category = await this.prisma.articleCategory.findFirst({
        where,
        include: {
          parent: true,
          children: { where: { isActive: true } },
          _count: { select: { articles: true } },
        },
      });

      if (!category) throw new NotFoundException('Category not found');
      return category;
    }, 'medium');
  }

  async createCategory(data: {
    name: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    parentId?: string;
  }, organizationId?: string) {
    const slug = data.slug || this.generateSlug(data.name);
    const result = await this.prisma.articleCategory.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder || 0,
        parentId: data.parentId,
        organizationId,
      },
    });

    await this.invalidateCache(organizationId);
    return result;
  }

  async updateCategory(id: string, data: {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    parentId?: string;
    isActive?: boolean;
  }, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const category = await this.prisma.articleCategory.findFirst({ where });
    if (!category) throw new NotFoundException('Category not found');

    const result = await this.prisma.articleCategory.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
        parentId: data.parentId,
        isActive: data.isActive,
      },
    });

    await this.cache.del(this.cache.key('kb', 'category', category.slug));
    await this.invalidateCache(organizationId);
    return result;
  }

  async deleteCategory(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) {
      where.organizationId = organizationId;
    }
    const category = await this.prisma.articleCategory.findFirst({ where });
    if (!category) throw new NotFoundException('Category not found');

    const articleCount = await this.prisma.article.count({ where: { categoryId: id } });
    if (articleCount > 0) {
      throw new Error('Cannot delete category with articles. Please reassign articles first.');
    }

    const childCount = await this.prisma.articleCategory.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new Error('Cannot delete category with subcategories. Please delete subcategories first.');
    }

    const result = await this.prisma.articleCategory.delete({ where: { id } });

    await this.cache.del(this.cache.key('kb', 'category', category.slug));
    await this.invalidateCache(organizationId);
    return result;
  }

  // Tags
  async findAllTags() {
    const cacheKey = this.cache.key('kb', 'tags');
    return this.cache.wrap(cacheKey, async () => {
      return this.prisma.tag.findMany({
        include: { _count: { select: { articles: true } } },
        orderBy: { name: 'asc' },
      });
    }, 'long');
  }

  async createTag(data: { name: string; description?: string; color?: string }) {
    const slug = this.generateSlug(data.name);
    const result = await this.prisma.tag.create({ data: { ...data, slug } });

    await this.cache.del(this.cache.key('kb', 'tags'));
    return result;
  }

  // Search - don't cache search results
  async search(query: string, page = 1, limit = 20, organizationId?: string) {
    const where: Prisma.ArticleWhereInput = {
      status: ArticleStatus.PUBLISHED,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      items: articles.map((a) => ({ ...a, tags: a.tags.map((t) => t.tag) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Stats
  async getStats(organizationId?: string) {
    const cacheKey = this.cache.key('kb', 'stats', organizationId || 'all');
    return this.cache.wrap(cacheKey, async () => {
      const where: any = {};
      if (organizationId) {
        where.organizationId = organizationId;
      }

      const [total, published, drafts, archived] = await Promise.all([
        this.prisma.article.count({ where }),
        this.prisma.article.count({ where: { ...where, status: ArticleStatus.PUBLISHED } }),
        this.prisma.article.count({ where: { ...where, status: ArticleStatus.DRAFT } }),
        this.prisma.article.count({ where: { ...where, status: ArticleStatus.ARCHIVED } }),
      ]);

      const topArticles = await this.prisma.article.findMany({
        where: { ...where, status: ArticleStatus.PUBLISHED },
        orderBy: { views: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          slug: true,
          views: true,
          helpfulYes: true,
          helpfulNo: true,
        },
      });

      return { total, published, drafts, archived, topArticles };
    }, 'short');
  }

  // Cache invalidation
  private async invalidateCache(organizationId?: string): Promise<void> {
    await this.cache.delPattern('cache:kb:articles*');
    await this.cache.del(this.cache.key('kb', 'categories'));
    await this.cache.del(this.cache.key('kb', 'stats'));
    if (organizationId) {
      await this.cache.del(this.cache.key('kb', 'categories', organizationId));
      await this.cache.del(this.cache.key('kb', 'stats', organizationId));
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
