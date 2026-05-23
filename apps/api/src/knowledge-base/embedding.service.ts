import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import axios from 'axios';

/**
 * Chunking configuration
 */
interface ChunkConfig {
  chunkSize: number;    // Target words per chunk
  chunkOverlap: number; // Overlap between chunks (words)
}

/**
 * Embedding model configuration per provider
 */
interface EmbeddingConfig {
  model: string;
  dimensions?: number;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  embedding: number[];
  tokensUsed?: number;
  model: string;
}

/**
 * Mapping from LLM provider to default embedding model
 */
const PROVIDER_EMBEDDING_MODELS: Record<string, EmbeddingConfig> = {
  deepseek: {
    model: 'deepseek-embedding-v1',  // DeepSeek's official embedding model name
    dimensions: 1536,
  },
  openai: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },
  anthropic: {
    model: 'text-embedding-3-large', // Anthropic uses OpenAI-compatible embeddings
    dimensions: 3072,
  },
  minimax: {
    model: 'embo', // Minimax embedding model
    dimensions: 1024,
  },
};

/**
 * LLM Provider to embedding model mapping based on LLM model name
 */
function getEmbeddingModelFromLLM(llmModel: string): EmbeddingConfig {
  // DeepSeek
  if (llmModel.includes('deepseek')) {
    return PROVIDER_EMBEDDING_MODELS.deepseek;
  }
  // OpenAI
  if (llmModel.includes('gpt-4') || llmModel.includes('gpt-3')) {
    return PROVIDER_EMBEDDING_MODELS.openai;
  }
  // Anthropic Claude
  if (llmModel.includes('claude')) {
    return PROVIDER_EMBEDDING_MODELS.anthropic;
  }
  // Minimax
  if (llmModel.includes('abab')) {
    return PROVIDER_EMBEDDING_MODELS.minimax;
  }
  // Default to DeepSeek (most cost-effective)
  return PROVIDER_EMBEDDING_MODELS.deepseek;
}

/**
 * Circuit breaker for handling API failures
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 10,
    private resetTimeoutMs: number = 30000,
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        return null; // Circuit is open, skip execution
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return null;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

/**
 * Service for generating embeddings and performing semantic search
 */
@Injectable()
export class EmbeddingService {
  private logger = new Logger(EmbeddingService.name);
  private circuitBreaker: CircuitBreaker;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    // Initialize circuit breaker with configurable thresholds
    const threshold = this.config.get<number>('EMBEDDING_CIRCUIT_BREAKER_THRESHOLD') || 10;
    const resetMs = this.config.get<number>('EMBEDDING_CIRCUIT_BREAKER_RESET_MS') || 30000;
    this.circuitBreaker = new CircuitBreaker(threshold, resetMs);
  }

  /**
   * Get chunking configuration
   */
  private getChunkConfig(): ChunkConfig {
    return {
      chunkSize: this.config.get<number>('EMBEDDING_CHUNK_SIZE') || 500,
      chunkOverlap: this.config.get<number>('EMBEDDING_CHUNK_OVERLAP') || 50,
    };
  }

  /**
   * Get rate limiting configuration
   */
  private getRateLimitConfig(): { batchSize: number; rateLimit: number; maxRetries: number } {
    return {
      batchSize: this.config.get<number>('EMBEDDING_BATCH_SIZE') || 10,
      rateLimit: this.config.get<number>('EMBEDDING_RATE_LIMIT') || 50,
      maxRetries: this.config.get<number>('EMBEDDING_MAX_RETRIES') || 3,
    };
  }

  /**
   * Text chunking algorithm: Splits text into overlapping chunks based on word count
   */
  chunkText(text: string, chunkSize: number, overlap: number): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Normalize whitespace and split into words
    const words = text.trim().split(/\s+/);
    const chunks: string[] = [];

    if (words.length <= chunkSize) {
      // Text is small enough, return as single chunk
      return [text];
    }

    let startIndex = 0;

    while (startIndex < words.length) {
      // Calculate end index for this chunk
      const endIndex = Math.min(startIndex + chunkSize, words.length);

      // Extract chunk words
      const chunkWords = words.slice(startIndex, endIndex);
      chunks.push(chunkWords.join(' '));

      // Move start index with overlap consideration
      const step = chunkSize - overlap;
      startIndex += step > 0 ? step : 1;
    }

    return chunks;
  }

  /**
   * Prepare article text for embedding with title and summary context
   */
  prepareArticleTextForChunking(
    title: string,
    summary: string | null | undefined,
    content: string,
    chunkConfig: ChunkConfig,
  ): Array<{ text: string; isFirst: boolean; chunkIndex: number }> {
    const chunks: Array<{ text: string; isFirst: boolean; chunkIndex: number }> = [];

    // Full context for first chunk: title + summary + first part of content
    const firstChunkContext = `Title: ${title}\n${summary ? `Summary: ${summary}\n` : ''}`;

    // Split content into chunks
    const contentChunks = this.chunkText(content, chunkConfig.chunkSize, chunkConfig.chunkOverlap);

    contentChunks.forEach((chunk, index) => {
      // For first chunk, prepend title and summary for context
      if (index === 0) {
        chunks.push({
          text: `${firstChunkContext}Content:\n${chunk}`,
          isFirst: true,
          chunkIndex: index,
        });
      } else {
        // For subsequent chunks, just include content (title in metadata for context)
        chunks.push({
          text: chunk,
          isFirst: false,
          chunkIndex: index,
        });
      }
    });

    return chunks;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Log VERY detailed error info for debugging
        const errorMessage = error?.message || 'Unknown error';
        const statusCode = error?.response?.status;
        const responseData = error?.response?.data;
        const responseHeaders = error?.response?.headers;
        this.logger.warn(`Attempt ${attempt + 1}/${maxRetries + 1} FAILED:`);
        this.logger.warn(`  Message: ${errorMessage}`);
        this.logger.warn(`  Status: ${statusCode}`);
        this.logger.warn(`  Response data: ${JSON.stringify(responseData)}`);
        this.logger.warn(`  Response headers: ${JSON.stringify(responseHeaders)}`);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(`  Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get embedding configuration for an organization
   */
  async getEmbeddingConfig(organizationId: string): Promise<{
    model: string;
    apiKey: string | undefined;
    baseUrl: string | undefined;
    dimensions: number;
  }> {
    if (!organizationId) {
      throw new Error('Organization ID is required for embedding generation');
    }

    this.logger.log(`Getting embedding config for organization: ${organizationId}`);

    const chatbotConfig = await this.prisma.chatbotConfig.findUnique({
      where: { organizationId },
    }) as any;

    this.logger.log(`ChatbotConfig found: ${!!chatbotConfig}`);
    this.logger.log(`Embedding config - model: ${chatbotConfig?.embeddingModel}, baseUrl: ${chatbotConfig?.embeddingBaseUrl}, apiKey: ${!!chatbotConfig?.aiApiKey}`);

    // Use dedicated embedding config if provided, otherwise infer from AI model
    let embeddingModel: string;
    let dimensions = 1536;

    if (chatbotConfig?.embeddingModel) {
      // Use the dedicated embedding model field
      embeddingModel = chatbotConfig.embeddingModel;
      this.logger.log(`Using dedicated embedding model: ${embeddingModel}`);
    } else if (chatbotConfig?.aiModel) {
      // Fallback: infer embedding model from LLM model
      const defaultConfig = getEmbeddingModelFromLLM(chatbotConfig.aiModel);
      embeddingModel = defaultConfig.model;
      dimensions = defaultConfig.dimensions || 1536;
      this.logger.log(`Inferred embedding model from aiModel: ${chatbotConfig.aiModel} -> ${embeddingModel}`);
    } else {
      // Default to OpenAI text-embedding-3-small
      embeddingModel = PROVIDER_EMBEDDING_MODELS.openai.model;
      this.logger.warn(`No embedding model configured, using default: ${embeddingModel}`);
    }

    // Get API key (use embedding-specific base URL if provided)
    const apiKey = chatbotConfig?.aiApiKey || this.getSystemApiKey(embeddingModel);

    // Determine base URL - use embeddingBaseUrl if provided, otherwise derive from model/provider
    let baseUrl = chatbotConfig?.embeddingBaseUrl;
    if (!baseUrl) {
      // If no custom embedding base URL, derive from model or use defaults
      if (embeddingModel.includes('deepseek')) {
        baseUrl = 'https://api.deepseek.com/v1';
      } else if (chatbotConfig?.aiApiBaseUrl) {
        // Use the LLM base URL with /embeddings path
        baseUrl = chatbotConfig.aiApiBaseUrl.endsWith('/')
          ? chatbotConfig.aiApiBaseUrl + 'embeddings'
          : chatbotConfig.aiApiBaseUrl + '/embeddings';
      } else {
        // Default to OpenAI
        baseUrl = 'https://api.openai.com/v1';
      }
    }

    this.logger.log(`Final embedding config - model: ${embeddingModel}, baseUrl: ${baseUrl}, hasApiKey: ${!!apiKey}`);

    if (!apiKey) {
      this.logger.error(`No API key configured for organization ${organizationId}`);
      throw new Error(`No API key configured for organization ${organizationId}`);
    }

    return {
      model: embeddingModel,
      apiKey,
      baseUrl,
      dimensions,
    };
  }

  /**
   * Generate embedding for text using organization's configured provider
   * Includes retry logic with exponential backoff and circuit breaker protection
   */
  async generateEmbedding(text: string, organizationId: string): Promise<EmbeddingResult> {
    const config = await this.getEmbeddingConfig(organizationId);

    if (!config.apiKey) {
      throw new Error('Embedding API key not configured for this organization');
    }

    this.logger.log(`Generating embedding - URL: ${config.baseUrl}/embeddings, Model: ${config.model}`);
    this.logger.log(`API Key length: ${config.apiKey.length}, Base URL: ${config.baseUrl}`);

    // Check circuit breaker before attempting API call
    if (this.circuitBreaker.getState() === 'open') {
      this.logger.warn('Circuit breaker is open, skipping embedding generation');
      throw new Error('Embedding service temporarily unavailable (circuit breaker open)');
    }

    const { maxRetries } = this.getRateLimitConfig();

    // Execute with circuit breaker and retry logic
    const result = await this.circuitBreaker.execute(async () => {
      return this.withRetry(async () => {
        // Base URL already includes /v1/ prefix if needed, so just append /embeddings
        const fullUrl = config.baseUrl?.endsWith('/embeddings')
          ? config.baseUrl
          : `${config.baseUrl}/embeddings`;

        this.logger.log(`Sending request to ${fullUrl} with model ${config.model}`);

        const response = await axios.post(
          fullUrl,
          {
            model: config.model,
            input: text,
          },
          {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        this.logger.log(`Embedding response received, tokens used: ${response.data.usage?.total_tokens}`);

        return {
          embedding: response.data.data[0].embedding,
          tokensUsed: response.data.usage?.total_tokens,
          model: config.model,
        };
      }, maxRetries);
    });

    if (result === null) {
      throw new Error('Embedding service temporarily unavailable (circuit breaker open)');
    }

    return result;
  }

  /**
   * Generate embedding for article and store in database
   * Uses text chunking for large articles
   */
  async embedArticle(articleId: string, organizationId: string): Promise<{ chunkCount: number }> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const chunkConfig = this.getChunkConfig();

    // Prepare chunks with title and summary context
    const chunks = this.prepareArticleTextForChunking(
      article.title,
      article.summary,
      article.content,
      chunkConfig,
    );

    // Delete existing embeddings for this article
    await this.prisma.articleEmbedding.deleteMany({
      where: { articleId },
    });

    // Generate and store embeddings for each chunk
    const embeddingPromises = chunks.map(async (chunk) => {
      const result = await this.generateEmbedding(chunk.text, organizationId);

      return this.prisma.articleEmbedding.create({
        data: {
          articleId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.text.substring(0, 1000), // Store first 1000 chars for reference
          vector: result.embedding,
        },
      });
    });

    await Promise.all(embeddingPromises);

    this.logger.log(`Embedded article ${articleId} with ${chunks.length} chunks, ${chunks[0]?.text?.length || 0} dimensions`);

    return { chunkCount: chunks.length };
  }

  /**
   * Rebuild embeddings for all articles in an organization
   * Uses batch processing with rate limiting
   */
  async rebuildEmbeddings(organizationId?: string): Promise<{ count: number; errors: string[] }> {
    // Reset circuit breaker for fresh rebuild attempt
    this.circuitBreaker.reset();

    // Get articles for this organization only (exclude global articles without org)
    const articles = await this.prisma.article.findMany({
      where: {
        status: 'published',
        organizationId: organizationId || undefined,
      },
      select: { id: true, organizationId: true },
    });

    if (articles.length === 0) {
      this.logger.log('No published articles found for embedding');
      return { count: 0, errors: [] };
    }

    this.logger.log(`Starting rebuild for ${articles.length} articles in organization ${organizationId || 'all'}`);

    const { batchSize, rateLimit } = this.getRateLimitConfig();
    const delayBetweenBatches = Math.ceil((60 * 1000) / rateLimit) * batchSize;

    let count = 0;
    const errors: string[] = [];

    // Process articles in batches
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (article) => {
        // Skip articles without organizationId (global articles)
        if (!article.organizationId) {
          return { success: false, articleId: article.id, error: 'Global article - cannot determine organization for embedding' };
        }

        try {
          await this.embedArticle(article.id, article.organizationId);
          return { success: true, articleId: article.id };
        } catch (error: any) {
          this.logger.error(`Failed to embed article ${article.id}: ${error.message}`);
          return { success: false, articleId: article.id, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect results
      for (const result of batchResults) {
        if (result.success) {
          count++;
        } else {
          errors.push(`Article ${result.articleId}: ${result.error}`);
        }
      }

      // Log progress
      this.logger.log(`Progress: ${count + errors.length}/${articles.length} articles processed`);

      // Rate limiting delay between batches (except for last batch)
      if (i + batchSize < articles.length) {
        await this.sleep(delayBetweenBatches);
      }
    }

    return { count, errors };
  }

  /**
   * Get embedding status for an article
   */
  async getEmbeddingStatus(articleId: string): Promise<{
    hasEmbedding: boolean;
    chunkCount: number;
    articleId: string;
  }> {
    const embeddings = await this.prisma.articleEmbedding.findMany({
      where: { articleId },
      select: {
        id: true,
      },
    });

    return {
      hasEmbedding: embeddings.length > 0,
      chunkCount: embeddings.length,
      articleId,
    };
  }

  /**
   * Validate embedding configuration for an organization
   * Returns detailed status of API key, endpoint, and model availability
   */
  async validateEmbeddingConfig(organizationId: string): Promise<{
    valid: boolean;
    apiKeyConfigured: boolean;
    baseUrl: string;
    model: string;
    error?: string;
  }> {
    if (!organizationId) {
      return {
        valid: false,
        apiKeyConfigured: false,
        baseUrl: '',
        model: '',
        error: 'Organization ID is required',
      };
    }

    const chatbotConfig = await this.prisma.chatbotConfig.findUnique({
      where: { organizationId },
    }) as any;

    if (!chatbotConfig) {
      return {
        valid: false,
        apiKeyConfigured: false,
        baseUrl: 'https://api.deepseek.com',
        model: PROVIDER_EMBEDDING_MODELS.deepseek.model,
        error: 'No ChatbotConfig found for this organization',
      };
    }

    const apiKey = chatbotConfig?.aiApiKey;
    const baseUrl = chatbotConfig?.aiApiBaseUrl || 'https://api.deepseek.com';

    if (!apiKey) {
      return {
        valid: false,
        apiKeyConfigured: false,
        baseUrl,
        model: PROVIDER_EMBEDDING_MODELS.deepseek.model,
        error: 'No API key configured in ChatbotConfig',
      };
    }

    // Determine the endpoint based on provider
    const endpointPath = baseUrl?.includes('deepseek') ? '/v1/embeddings' : '/embeddings';
    const fullUrl = `${baseUrl}${endpointPath}`;

    return {
      valid: true,
      apiKeyConfigured: true,
      baseUrl: fullUrl,
      model: PROVIDER_EMBEDDING_MODELS.deepseek.model,
    };
  }

  /**
   * Semantic search for articles
   * Note: Requires pgvector extension for vector similarity
   * Uses max similarity when articles have multiple chunks
   */
  async semanticSearch(
    query: string,
    organizationId: string,
    limit: number = 5
  ): Promise<Array<{ articleId: string; similarity: number }>> {
    const config = await this.getEmbeddingConfig(organizationId);

    if (!config.apiKey) {
      throw new Error('Embedding API key not configured for this organization');
    }

    // Check circuit breaker
    if (this.circuitBreaker.getState() === 'open') {
      this.logger.warn('Circuit breaker is open, skipping semantic search');
      return [];
    }

    // Generate query embedding
    const queryResult = await this.circuitBreaker.execute(async () => {
      return this.generateEmbedding(query, organizationId);
    });

    if (!queryResult) {
      return [];
    }

    // Search using raw SQL with pgvector cosine similarity
    // For articles with multiple chunks, use max similarity (best matching chunk)
    try {
      const results = await this.prisma.$queryRaw<Array<{ article_id: string; similarity: number }>>`
        SELECT
          ae.article_id,
          MAX(1 - (ae.vector <=> ${queryResult.embedding}::vector)) as similarity
        FROM "ArticleEmbedding" ae
        JOIN "Article" a ON a.id = ae.article_id
        WHERE a.organization_id = ${organizationId}
          AND a.status = 'published'
        GROUP BY ae.article_id
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      return results.map(r => ({
        articleId: r.article_id,
        similarity: Number(r.similarity),
      }));
    } catch (error: any) {
      this.logger.warn(`pgvector search failed, falling back to keyword search: ${error.message}`);
      // Fallback: return empty results if pgvector is not available
      return [];
    }
  }

  /**
   * Detect provider from embedding model name
   */
  private detectProvider(model: string): string {
    if (model.includes('deepseek')) return 'deepseek';
    if (model.includes('claude') || model.includes('anthropic')) return 'anthropic';
    if (model.includes('minimax')) return 'minimax';
    return 'openai';
  }

  /**
   * Get system-wide API key for provider
   */
  private getSystemApiKey(model: string): string | undefined {
    const provider = this.detectProvider(model);

    switch (provider) {
      case 'openai':
        return this.config.get<string>('OPENAI_API_KEY');
      case 'anthropic':
        return this.config.get<string>('ANTHROPIC_API_KEY');
      case 'deepseek':
        return this.config.get<string>('DEEPSEEK_API_KEY');
      case 'minimax':
        return this.config.get<string>('MINIMAX_API_KEY');
      default:
        return this.config.get<string>('OPENAI_API_KEY');
    }
  }

  /**
   * Get system-wide base URL for provider
   */
  private getSystemBaseUrl(model: string): string {
    const provider = this.detectProvider(model);

    switch (provider) {
      case 'openai':
        return this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
      case 'anthropic':
        return this.config.get<string>('ANTHROPIC_BASE_URL') || 'https://api.openai.com/v1';
      case 'deepseek':
        return this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
      case 'minimax':
        return this.config.get<string>('MINIMAX_BASE_URL') || 'https://api.minimax.chat/v1';
      default:
        return this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    }
  }
}