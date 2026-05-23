import { Injectable, Logger } from '@nestjs/common';
import { BaseToolPlugin, ToolDefinition, ToolContext, ToolResult } from '../base-tool.interface';
import { ApiClientService, RequestContext } from '../../http/api-client.service';

/**
 * Knowledge Base Module Tool Plugin
 * Provides search and retrieval for knowledge base articles via API
 */
@Injectable()
export class KnowledgeBaseToolPlugin extends BaseToolPlugin {
  private logger = new Logger(KnowledgeBaseToolPlugin.name);

  constructor(private apiClient: ApiClientService) {
    super();
  }

  readonly moduleName = 'knowledge_base';
  readonly displayName = 'Knowledge Base';
  readonly description = 'Search and retrieve knowledge base articles';

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'search_knowledge_base',
        description: 'Search knowledge base articles by keywords',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          query: { type: 'string', description: 'Search query keywords', required: true },
          categoryId: { type: 'string', description: 'Filter by category ID', required: false },
          limit: { type: 'number', description: 'Max results (default 5, max 20)', required: false, default: 5 },
        },
      },
      {
        name: 'get_kb_article',
        description: 'Get full details of a knowledge base article',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          articleId: { type: 'string', description: 'Article ID or slug', required: true },
        },
      },
      {
        name: 'get_kb_article_by_slug',
        description: 'Get knowledge base article by URL slug',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          slug: { type: 'string', description: 'Article URL slug', required: true },
        },
      },
      {
        name: 'get_kb_categories',
        description: 'List all knowledge base categories',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          limit: { type: 'number', description: 'Max results', required: false, default: 20 },
        },
      },
      {
        name: 'get_kb_articles_by_category',
        description: 'Get all published articles in a category',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          categoryId: { type: 'string', description: 'Category ID', required: true },
          limit: { type: 'number', description: 'Max results', required: false, default: 10 },
        },
      },
      {
        name: 'get_popular_kb_articles',
        description: 'Get most viewed/popular knowledge base articles',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          limit: { type: 'number', description: 'Number of articles (default 5)', required: false, default: 5 },
        },
      },
      {
        name: 'get_recent_kb_articles',
        description: 'Get recently published knowledge base articles',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          limit: { type: 'number', description: 'Number of articles (default 5)', required: false, default: 5 },
        },
      },
      {
        name: 'get_kb_article_count',
        description: 'Get count of published articles, optionally by category',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          categoryId: { type: 'string', description: 'Filter by category', required: false },
        },
      },
      // File to Article conversion
      {
        name: 'create_kb_article_from_file',
        description: 'Create a knowledge base article from an uploaded file attachment. Extracts content from text files (TXT, MD) or parses documents to create a draft article.',
        category: 'Knowledge Base',
        module: this.moduleName,
        requiredModules: ['knowledge_base'],
        parameters: {
          fileId: { type: 'string', description: 'File/Attachment ID to convert to article', required: true },
          title: { type: 'string', description: 'Title for the new article', required: true },
          categoryId: { type: 'string', description: 'Category ID to place the article in', required: false },
          status: { type: 'string', description: 'Article status (draft/published)', required: false, default: 'draft' },
        },
      },
    ];
  }

  async execute(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'search_knowledge_base':
          return this.searchKnowledgeBase(params, context);
        case 'get_kb_article':
          return this.getKBArticle(params, context);
        case 'get_kb_article_by_slug':
          return this.getKBArticleBySlug(params, context);
        case 'get_kb_categories':
          return this.getKBCategories(params, context);
        case 'get_kb_articles_by_category':
          return this.getKBArticlesByCategory(params, context);
        case 'get_popular_kb_articles':
          return this.getPopularKBArticles(params, context);
        case 'get_recent_kb_articles':
          return this.getRecentKBArticles(params, context);
        case 'get_kb_article_count':
          return this.getKBArticleCount(params, context);
        case 'create_kb_article_from_file':
          return this.createKBArticleFromFile(params, context);

        default:
          return { success: false, toolName, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      this.logger.error(`Error executing ${toolName}: ${error?.message || error}`);
      return { success: false, toolName, error: error?.message || 'Unknown error' };
    }
  }

  private buildRequestContext(context: ToolContext): RequestContext {
    return {
      userId: context.userId,
      organizationId: context.organizationId,
      userEmail: context.userEmail,
    };
  }

  private async searchKnowledgeBase(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);
    const limit = Math.min(params.limit || 5, 20);

    // Try hybrid search first (semantic + keyword), fallback to keyword search
    let response = await this.apiClient.get('/v1/knowledge-base/articles/search-hybrid', reqContext, {
      q: params.query,
      limit: limit,
    });

    // Fallback to keyword search if hybrid search fails or returns empty
    if (!response.success || !response.data || (Array.isArray(response.data) && response.data.length === 0)) {
      response = await this.apiClient.get('/v1/knowledge-base/articles/search', reqContext, {
        q: params.query,
        categoryId: params.categoryId,
        limit: limit,
      });
    }

    if (!response.success) {
      return { success: false, toolName: 'search_knowledge_base', error: response.error };
    }

    const articles = Array.isArray(response.data) ? response.data : (response.data.items || response.data.articles || []);

    const results = articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      category: a.categoryName || (a.category ? a.category.name : null),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      // Include similarity score if available (from semantic search)
      similarity: a.similarity,
      searchType: a.searchType || 'keyword',
    }));

    return {
      success: true,
      toolName: 'search_knowledge_base',
      result: {
        query: params.query,
        total: results.length,
        articles: results,
        searchMode: articles[0]?.searchType === 'semantic' ? 'hybrid (semantic + keyword)' : 'keyword',
      },
      references: results.map((a: any) => ({
        type: 'article' as const,
        id: a.id,
        title: a.title,
        url: `/knowledge-base/${a.slug}`,
      })),
    };
  }

  private async getKBArticle(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Try by ID first, then by slug
    let response = await this.apiClient.get(`/v1/knowledge-base/articles/${params.articleId}`, reqContext);

    if (!response.success && response.statusCode === 404) {
      // Try by slug endpoint
      response = await this.apiClient.get(`/v1/knowledge-base/articles/slug/${params.articleId}`, reqContext);
    }

    if (!response.success) {
      return { success: false, toolName: 'get_kb_article', error: response.error };
    }

    const article = response.data;

    return {
      success: true,
      toolName: 'get_kb_article',
      result: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.categoryName || (article.category ? {
          id: article.category.id,
          name: article.category.name,
        } : null),
        viewCount: article.views,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      },
      references: [{
        type: 'article',
        id: article.id,
        title: article.title,
        url: `/knowledge-base/${article.slug}`,
      }],
    };
  }

  private async getKBArticleBySlug(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get(`/v1/knowledge-base/articles/slug/${params.slug}`, reqContext);

    if (!response.success) {
      return { success: false, toolName: 'get_kb_article_by_slug', error: response.error };
    }

    const article = response.data;

    return {
      success: true,
      toolName: 'get_kb_article_by_slug',
      result: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.categoryName || (article.category ? article.category.name : null),
      },
      references: [{
        type: 'article',
        id: article.id,
        title: article.title,
        url: `/knowledge-base/${article.slug}`,
      }],
    };
  }

  private async getKBCategories(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/knowledge-base/categories', reqContext, {
      limit: params.limit || 20,
    });

    if (!response.success) {
      return { success: false, toolName: 'get_kb_categories', error: response.error };
    }

    const categories = Array.isArray(response.data) ? response.data : (response.data.items || response.data.categories || []);

    return {
      success: true,
      toolName: 'get_kb_categories',
      result: {
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          articleCount: c.articleCount || c._count?.articles || 0,
        })),
      },
    };
  }

  private async getKBArticlesByCategory(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/knowledge-base/articles', reqContext, {
      categoryId: params.categoryId,
      limit: params.limit || 10,
      status: 'published',
    });

    if (!response.success) {
      return { success: false, toolName: 'get_kb_articles_by_category', error: response.error };
    }

    const articles = Array.isArray(response.data) ? response.data : (response.data.items || response.data.articles || []);

    return {
      success: true,
      toolName: 'get_kb_articles_by_category',
      result: {
        categoryId: params.categoryId,
        total: articles.length,
        articles: articles.map((a: any) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          viewCount: a.views,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      },
      references: articles.map((a: any) => ({
        type: 'article' as const,
        id: a.id,
        title: a.title,
        url: `/knowledge-base/${a.slug}`,
      })),
    };
  }

  private async getPopularKBArticles(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/knowledge-base/articles/popular', reqContext, {
      limit: params.limit || 5,
    });

    if (!response.success) {
      return { success: false, toolName: 'get_popular_kb_articles', error: response.error };
    }

    const articles = Array.isArray(response.data) ? response.data : (response.data.items || response.data.articles || []);

    return {
      success: true,
      toolName: 'get_popular_kb_articles',
      result: {
        articles: articles.map((a: any) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          views: a.views,
        })),
      },
      references: articles.map((a: any) => ({
        type: 'article' as const,
        id: a.id,
        title: a.title,
        url: `/knowledge-base/${a.slug}`,
      })),
    };
  }

  private async getRecentKBArticles(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/knowledge-base/articles/recent', reqContext, {
      limit: params.limit || 5,
    });

    if (!response.success) {
      return { success: false, toolName: 'get_recent_kb_articles', error: response.error };
    }

    const articles = Array.isArray(response.data) ? response.data : (response.data.items || response.data.articles || []);

    return {
      success: true,
      toolName: 'get_recent_kb_articles',
      result: {
        articles: articles.map((a: any) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          summary: a.summary,
          publishedAt: a.createdAt,
        })),
      },
      references: articles.map((a: any) => ({
        type: 'article' as const,
        id: a.id,
        title: a.title,
        url: `/knowledge-base/${a.slug}`,
      })),
    };
  }

  private async getKBArticleCount(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/knowledge-base/articles', reqContext, {
      categoryId: params.categoryId,
      status: 'published',
      limit: 1, // We only need the count, API may return total
    });

    if (!response.success) {
      return { success: false, toolName: 'get_kb_article_count', error: response.error };
    }

    const count = response.data.total || response.data.count || 0;

    return {
      success: true,
      toolName: 'get_kb_article_count',
      result: {
        count,
        categoryId: params.categoryId || null,
      },
    };
  }

  /**
   * Create a knowledge base article from an uploaded file
   * First downloads the file content, then creates the article
   */
  private async createKBArticleFromFile(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First, get the attachment details
    const attachmentResponse = await this.apiClient.get(`/v1/storage/${params.fileId}`, reqContext);

    if (!attachmentResponse.success) {
      return { success: false, toolName: 'create_kb_article_from_file', error: 'File not found' };
    }

    const attachment = attachmentResponse.data;

    // Check if file type is supported
    const supportedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
    if (!supportedTypes.includes(attachment.mimeType)) {
      return {
        success: false,
        toolName: 'create_kb_article_from_file',
        error: `File type "${attachment.mimeType}" is not supported for article conversion. Supported types: TXT, MD, PDF`,
      };
    }

    // For text files, we can extract content directly
    // For PDF, we'd need a PDF parser library (not implemented yet)
    if (attachment.mimeType === 'application/pdf') {
      return {
        success: false,
        toolName: 'create_kb_article_from_file',
        error: 'PDF conversion is not yet supported. Please use TXT or MD files.',
      };
    }

    // Get file content (the storage endpoint returns file data)
    let content = '';
    if (attachment.storagePath) {
      // Try to download the file content
      try {
        const contentResponse = await this.apiClient.get(`/v1/storage/download/${params.fileId}`, reqContext);
        if (contentResponse.success && contentResponse.data) {
          content = typeof contentResponse.data === 'string' ? contentResponse.data : JSON.stringify(contentResponse.data);
        }
      } catch (err) {
        this.logger.warn('Could not fetch file content, creating article with reference only');
      }
    }

    // Generate summary from content
    const summary = content.length > 200 ? content.substring(0, 197) + '...' : content;

    // Create the article via API
    const createResponse = await this.apiClient.post('/v1/knowledge-base/articles', reqContext, {
      title: params.title,
      content: content || `[Content from file: ${attachment.originalName}]`,
      summary: summary,
      categoryId: params.categoryId || null,
      status: params.status || 'draft',
      source: `Converted from file: ${attachment.originalName}`,
    });

    if (!createResponse.success) {
      return { success: false, toolName: 'create_kb_article_from_file', error: createResponse.error };
    }

    const article = createResponse.data;

    return {
      success: true,
      toolName: 'create_kb_article_from_file',
      result: {
        message: `Article "${article.title}" created successfully`,
        articleId: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
      },
      references: [{
        type: 'article',
        id: article.id,
        title: article.title,
        url: `/knowledge-base/${article.slug}`,
      }],
    };
  }
}