import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PrismaService } from '../common/prisma.service';
import { ModuleLicenseGuard, RequiredModule } from '../auth/guards/module-license.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationId } from '../decorators/organization.decorator';
import { CacheControl } from '../cache/cache-control.decorator';
import { UserRole } from '@helix/shared';

@ApiTags('knowledge-base')
@Controller('knowledge-base')
@UseGuards(ModuleLicenseGuard)
@RequiredModule('knowledge_base')
@ApiBearerAuth()
export class KnowledgeBaseController {
  constructor(
    private kbService: KnowledgeBaseService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // Articles
  @Get('articles')
  @CacheControl('medium')
  @ApiOperation({ summary: 'List articles' })
  findAllArticles(
    @Query('status') status?: 'draft' | 'published' | 'archived',
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @OrganizationId() organizationId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.kbService.findAllArticles({
      status,
      categoryId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      organizationId,
      userId: user?.id,
      userRole: user?.role,
    });
  }

  @Get('articles/search')
  @CacheControl('short')
  @ApiOperation({ summary: 'Search articles' })
  search(
    @Query('q') query: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @OrganizationId() organizationId?: string,
  ) {
    return this.kbService.search(query, page, limit, organizationId);
  }

  @Get('articles/search-hybrid')
  @CacheControl('short')
  @ApiOperation({ summary: 'Hybrid search: combines semantic and keyword search' })
  hybridSearch(
    @Query('q') query: string,
    @Query('limit') limit?: number,
    @OrganizationId() organizationId?: string,
  ) {
    return this.kbService.hybridSearch({ query, limit, organizationId });
  }

  @Get('articles/suggest')
  @CacheControl('short')
  @ApiOperation({ summary: 'Get article suggestions' })
  suggest(@Query('q') query: string, @OrganizationId() organizationId?: string) {
    return this.kbService.search(query, 1, 5, organizationId);
  }

  @Get('articles/popular')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get popular articles' })
  popular(@OrganizationId() organizationId?: string) {
    return this.kbService.findAllArticles({ limit: 10, organizationId });
  }

  @Get('articles/recent')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get recent articles' })
  recent(@OrganizationId() organizationId?: string) {
    return this.kbService.findAllArticles({ status: 'published', organizationId });
  }

  @Get('articles/:slug')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get article by slug' })
  findOne(@Param('slug') slug: string, @OrganizationId() organizationId: string, @CurrentUser() user?: any) {
    return this.kbService.findArticleBySlug(slug, organizationId, user?.id, user?.role);
  }

  @Post('articles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create article' })
  create(@Body() data: any, @CurrentUser() user: any, @OrganizationId() organizationId?: string) {
    return this.kbService.createArticle(data, user.id, organizationId);
  }

  @Patch('articles/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update article' })
  update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any, @OrganizationId() organizationId?: string) {
    return this.kbService.updateArticle(id, data, user.id, organizationId);
  }

  @Post('articles/:id/publish')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Publish article' })
  publish(@Param('id') id: string, @CurrentUser('id') userId: string, @OrganizationId() organizationId?: string) {
    return this.kbService.publishArticle(id, userId, organizationId);
  }

  @Post('articles/:id/archive')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Archive article' })
  archive(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.kbService.archiveArticle(id, organizationId);
  }

  @Post('articles/:id/feedback')
  @ApiOperation({ summary: 'Submit article feedback' })
  submitFeedback(@Param('id') id: string, @Body() data: { helpful: boolean }) {
    return this.kbService.submitFeedback(id, data.helpful);
  }

  // Categories
  @Get('categories')
  @CacheControl('long')
  @ApiOperation({ summary: 'List categories' })
  findAllCategories(@OrganizationId() organizationId?: string) {
    return this.kbService.findAllCategories(organizationId);
  }

  @Get('categories/tree')
  @CacheControl('long')
  @ApiOperation({ summary: 'Get category tree hierarchy' })
  getCategoryTree(@OrganizationId() organizationId?: string) {
    return this.kbService.getCategoryTree(organizationId);
  }

  @Get('categories/:slug')
  @CacheControl('medium')
  @ApiOperation({ summary: 'Get category by slug' })
  findCategory(@Param('slug') slug: string, @OrganizationId() organizationId?: string) {
    return this.kbService.findCategoryBySlug(slug, organizationId);
  }

  @Post('categories')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Create article category' })
  createCategory(@Body() data: any, @OrganizationId() organizationId?: string) {
    return this.kbService.createCategory(data, organizationId);
  }

  @Patch('categories/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Update article category' })
  updateCategory(@Param('id') id: string, @Body() data: any, @OrganizationId() organizationId?: string) {
    return this.kbService.updateCategory(id, data, organizationId);
  }

  @Delete('categories/:id')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Delete article category' })
  deleteCategory(@Param('id') id: string, @OrganizationId() organizationId?: string) {
    return this.kbService.deleteCategory(id, organizationId);
  }

  // Tags
  @Get('tags')
  @CacheControl('long')
  @ApiOperation({ summary: 'List tags' })
  findAllTags() {
    return this.kbService.findAllTags();
  }

  @Post('tags')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create tag' })
  createTag(@Body() data: { name: string; description?: string; color?: string }) {
    return this.kbService.createTag(data);
  }

  // Stats
  @Get('stats/dashboard')
  @CacheControl('short')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KB statistics' })
  getStats(@OrganizationId() organizationId?: string) {
    return this.kbService.getStats(organizationId);
  }

  // Embeddings (Admin)
  @Get('embeddings/status/:articleId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get embedding status for an article' })
  async getEmbeddingStatus(@Param('articleId') articleId: string) {
    // Import EmbeddingService here to avoid circular dependency
    const { EmbeddingService } = await import('./embedding.service');
    const embeddingService = new EmbeddingService(this.prisma, this.config);
    return embeddingService.getEmbeddingStatus(articleId);
  }

  @Get('embeddings/validate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate embedding configuration for the organization' })
  async validateEmbeddingConfig(@OrganizationId() organizationId?: string) {
    const { EmbeddingService } = await import('./embedding.service');
    const embeddingService = new EmbeddingService(this.prisma, this.config);
    return embeddingService.validateEmbeddingConfig(organizationId || '');
  }

  @Post('embeddings/rebuild')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.user)
  @ApiOperation({ summary: 'Rebuild embeddings for all articles in organization' })
  async rebuildEmbeddings(@OrganizationId() organizationId?: string) {
    // Import EmbeddingService here to avoid circular dependency
    const { EmbeddingService } = await import('./embedding.service');
    const embeddingService = new EmbeddingService(this.prisma, this.config);
    const result = await embeddingService.rebuildEmbeddings(organizationId);
    return {
      success: result.errors.length === 0,
      articlesProcessed: result.count,
      errors: result.errors,
    };
  }
}
