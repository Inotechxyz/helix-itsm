import { Injectable, Logger, ForbiddenException, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PrismaClient, ChatMessageRole, ChatContentType, ChatbotSessionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { LLMService, LLMMessage, OrgLLMConfig, LLMFunctionTool, LLMToolCall } from './llm/llm.service';
import { ToolExecutorService, ToolResult } from './tools/tool-executor.service';
import { LicenseService } from '@inotechxyz/protected-license';
import { ChatbotAuditService } from './audit/chatbot-audit.service';
import { ChatbotPromptConfigService } from '../config/chatbot-prompt-config.service';
import { parseDSMLToolCalls, cleanDSMLFromContent, hasDSMLToolCalls, DSMLToolCall } from './utils/dsml-parser';
import {
  SendMessageDto,
  CreateSessionDto,
  UpdateChatbotConfigDto,
  MessageFeedbackDto,
  ChatContextDto,
  MessageResponseDto,
  SessionResponseDto,
  SessionWithMessagesDto,
  ChatbotConfigResponseDto,
} from './dto/chatbot.dto';

/**
 * Chatbot Service - Main service for AI chatbot functionality
 */
@Injectable()
export class ChatbotService {
  private logger = new Logger(ChatbotService.name);

  constructor(
    private prisma: PrismaService,
    private llmService: LLMService,
    private toolExecutor: ToolExecutorService,
    private licenseService: LicenseService,
    private auditService: ChatbotAuditService,
    private promptConfig: ChatbotPromptConfigService,
  ) {}

  /**
   * Check if AI is enabled for an organization
   */
  async isAIEnabled(organizationId: string): Promise<boolean> {
    if (!organizationId) {
      return false;
    }
    return this.licenseService.isAIEnabled(organizationId);
  }

  /**
   * Get AI model for an organization
   */
  async getAIModel(organizationId: string): Promise<string> {
    if (!organizationId) {
      return 'gpt-4o-mini';
    }

    // Check organization config first
    const config = await this.prisma.chatbotConfig.findUnique({
      where: { organizationId },
    });

    if (config?.aiModel) {
      return config.aiModel;
    }

    // Fall back to license config
    return this.licenseService.getAIModel(organizationId);
  }

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    organizationId: string,
    dto: CreateSessionDto,
    userContext: any,
  ): Promise<SessionWithMessagesDto> {
    this.logger.log(`[ChatbotService] createSession called: userId=${userId}, organizationId=${organizationId}`);

    if (!organizationId) {
      this.logger.error('[ChatbotService] Organization ID is required but was not provided');
      throw new Error('Organization ID is required');
    }

    // Check if AI is enabled
    const aiEnabled = await this.isAIEnabled(organizationId);
    this.logger.log(`[ChatbotService] AI enabled check: ${aiEnabled}`);
    if (!aiEnabled) {
      this.logger.warn(`[ChatbotService] AI chatbot is not enabled for organization: ${organizationId}`);
      throw new ForbiddenException('AI chatbot is not enabled for this organization');
    }

    // Use transaction for batch database operations
    const sessionId = uuidv4();
    this.logger.log(`[ChatbotService] Creating session with sessionId=${sessionId}, orgId=${organizationId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      // Get or create chatbot config
      let config = await tx.chatbotConfig.findUnique({
        where: { organizationId },
      });

      if (!config) {
        this.logger.log(`[ChatbotService] Creating new chatbot config for org: ${organizationId}`);
        config = await tx.chatbotConfig.create({
          data: {
            organizationId,
          },
        });
      }

      // Create session and greeting message in transaction
      const session = await tx.chatbotSession.create({
        data: {
          sessionId: sessionId,
          userId,
          organizationId,
          status: 'active' as ChatbotSessionStatus,
          userEmail: userContext?.email,
          userFirstName: userContext?.firstName,
          userLastName: userContext?.lastName,
          userOrgRole: userContext?.orgRole,
          messageCount: 1, // Set initial count
        },
      });

      this.logger.log(`[ChatbotService] Session created: db.id=${session.id}, sessionId=${sessionId}`);

      // Create greeting message
      await tx.chatbotMessage.create({
        data: {
          sessionId: session.id,
          messageId: uuidv4(),
          role: 'assistant' as ChatMessageRole,
          content: config.greetingMessage,
          contentType: 'text' as ChatContentType,
          aiModel: config.aiModel,
        },
      });

      return session;
    });

    // Fetch complete session with messages (outside transaction to release connection)
    const sessionWithMessages = await this.getSessionWithMessages(result.id, userId, organizationId);

    // Log audit for session creation
    this.auditService.logSessionCreate(
      result.sessionId, // Use the string sessionId for the audit entity
      organizationId,
      userId,
      userContext?.email,
      {
        sessionId: result.sessionId,
        messageCount: 1,
        status: 'active',
      },
    ).catch((err) => this.logger.error('Failed to log session create audit', { err }));

    return sessionWithMessages;
  }

  /**
   * Get session with messages
   */
  async getSessionWithMessages(sessionId: string, userId: string, organizationId: string): Promise<SessionWithMessagesDto> {
    this.logger.log(`[ChatbotService] getSessionWithMessages: sessionId=${sessionId}, userId=${userId}, organizationId=${organizationId}`);

    const session = await this.prisma.chatbotSession.findFirst({
      where: {
        OR: [
          { id: sessionId },
          { sessionId: sessionId },
        ],
        organizationId,
        userId, // Ensure user can only access their own sessions
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      this.logger.warn(`[ChatbotService] Session not found or access denied: sessionId=${sessionId}, userId=${userId}, organizationId=${organizationId}`);
      throw new NotFoundException('Session not found');
    }

    this.logger.log(`[ChatbotService] Session found: db.id=${session.id}, sessionId=${session.sessionId}, messageCount=${session.messageCount}`);

    return {
      id: session.id,
      sessionId: session.sessionId,
      status: session.status,
      userEmail: session.userEmail ?? undefined,
      userFirstName: session.userFirstName ?? undefined,
      userLastName: session.userLastName ?? undefined,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt ?? undefined,
      messages: session.messages.map((m) => ({
        id: m.id,
        messageId: m.messageId,
        role: m.role,
        content: m.content,
        contentType: m.contentType,
        intent: m.intent ?? undefined,
        aiModel: m.aiModel ?? undefined,
        tokensUsed: m.tokensUsed ?? undefined,
        toolCalls: m.toolCalls ?? undefined,
        references: m.references ?? undefined,
        userFeedback: m.userFeedback ?? undefined,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * Get session info without messages
   */
  async getSession(sessionId: string, userId: string, organizationId: string): Promise<SessionResponseDto> {
    this.logger.log(`[ChatbotService] getSession: sessionId=${sessionId}, userId=${userId}, organizationId=${organizationId}`);

    const session = await this.prisma.chatbotSession.findFirst({
      where: {
        OR: [{ id: sessionId }, { sessionId }],
        organizationId,
        userId, // Ensure user can only access their own sessions
      },
    });

    if (!session) {
      this.logger.warn(`[ChatbotService] Session not found or access denied: sessionId=${sessionId}, userId=${userId}, organizationId=${organizationId}`);
      throw new NotFoundException('Session not found');
    }

    this.logger.log(`[ChatbotService] Session found: db.id=${session.id}, sessionId=${session.sessionId}, status=${session.status}`);

    return {
      id: session.id,
      sessionId: session.sessionId,
      status: session.status,
      userEmail: session.userEmail ?? undefined,
      userFirstName: session.userFirstName ?? undefined,
      userLastName: session.userLastName ?? undefined,
      messageCount: session.messageCount,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt ?? undefined,
    };
  }

  /**
   * Process a user message and generate AI response
   */
  async processMessage(
    sessionId: string,
    userId: string,
    organizationId: string,
    dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Check if AI is enabled
    if (!(await this.isAIEnabled(organizationId))) {
      throw new ForbiddenException('AI chatbot is not enabled for this organization');
    }

    // Get session
    const session = await this.prisma.chatbotSession.findFirst({
      where: {
        OR: [{ id: sessionId }, { sessionId }],
        organizationId,
        userId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status === 'closed') {
      throw new ForbiddenException('Session is closed');
    }

    // Get AI config
    const config = await this.prisma.chatbotConfig.findUnique({
      where: { organizationId },
    });

    const aiModel = config?.aiModel || (await this.getAIModel(organizationId));

    // Get enabled modules
    const enabledModules = await this.licenseService.getEnabledModules(organizationId);

    // Save user message with attachments
    const userMessage = await this.prisma.chatbotMessage.create({
      data: {
        sessionId: session.id,
        messageId: uuidv4(),
        role: 'user' as ChatMessageRole,
        content: dto.content,
        contentType: dto.attachments && dto.attachments.length > 0 ? 'rich' as ChatContentType : 'text' as ChatContentType,
        references: dto.attachments ? dto.attachments.map(a => ({
          type: 'attachment',
          id: a.id,
          name: a.name,
          size: a.size,
          mimeType: a.type,
        })) : undefined,
      },
    });

    // Log audit for user message sent
    this.auditService.logMessageSend(
      userMessage.messageId,
      session.sessionId,
      organizationId,
      userId,
      session.userEmail ?? undefined,
      {
        messageId: userMessage.messageId,
        sessionId: session.sessionId,
        contentLength: dto.content.length,
        hasToolCalls: false,
        toolCallCount: 0,
        attachments: dto.attachments?.map(a => ({ id: a.id, name: a.name, size: a.size, type: a.type })),
      },
    ).catch((err) => this.logger.error('Failed to log message send audit', { err }));

    // Update session
    await this.prisma.chatbotSession.update({
      where: { id: session.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });

    // Build context and generate response
    const context = await this.buildContext(organizationId, userId, enabledModules);
    const systemPrompt = this.buildSystemPrompt(config, context);
    const conversationHistory = await this.getConversationHistory(session.id);

    // Build org-specific LLM config
    const orgLLMConfig: OrgLLMConfig = {
      apiKey: config?.aiApiKey || undefined,
      baseUrl: config?.aiApiBaseUrl || undefined,
      model: aiModel,
      reasoningEnabled: (config as any)?.reasoningEnabled ?? false,
    };

    // Get available tools
    const availableTools = await this.toolExecutor.getAvailableTools(organizationId);
    const tools = this.convertToolsToLLMFormat(availableTools);

    this.logger.log(`[ChatbotService] Converted ${tools.length} tools for LLM`);
    for (const tool of tools) {
      this.logger.debug(`[ChatbotService] Tool: ${tool.name}, required: ${JSON.stringify(tool.parameters.required)}`);
    }

    // Build messages for LLM
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: dto.content },
    ];

    this.logger.debug(`[ChatbotService] Building LLM request with ${messages.length} messages`);
    this.logger.debug(`[ChatbotService] System prompt length: ${systemPrompt.length}`);
    this.logger.debug(`[ChatbotService] Conversation history: ${conversationHistory.length} messages`);
    messages.forEach((m, i) => {
      this.logger.debug(`[ChatbotService] Message ${i}: role=${m.role}, content length=${m.content?.length || 0}`);
    });

    try {
      // Generate initial response (with tools if available)
      let response = await this.llmService.generate(aiModel, messages, {
        temperature: config?.aiTemperature ?? 0.7,
        maxTokens: config?.aiMaxTokens ?? 2000,
      }, orgLLMConfig, tools.length > 0 ? tools : undefined);

      // Handle tool calls if present (either from API tool_calls or from DSML in content)
      let finalContent = response.content;
      let detectedToolCalls: DSMLToolCall[] = [];
      const allReferences: any[] = [];

      // Check for API tool_calls
      if (response.finishReason === 'tool_calls' && response.toolCalls && response.toolCalls.length > 0) {
        this.logger.log(`Processing ${response.toolCalls.length} API tool calls`);

        // Execute each tool call
        const toolResults: ToolResult[] = [];
        for (const toolCall of response.toolCalls) {
          let args = typeof toolCall.arguments === 'string'
            ? JSON.parse(toolCall.arguments)
            : toolCall.arguments;

          this.logger.log(`[ChatbotService] Executing tool ${toolCall.name} with args: ${JSON.stringify(args)}`);

          const result = await this.toolExecutor.executeTool(
            toolCall.name, args, userId, organizationId
          );

          this.logger.log(`[ChatbotService] Tool ${toolCall.name} result: success=${result.success}, error=${result.error}`);
          toolResults.push(result);

          if (result.references) {
            allReferences.push(...result.references);
          }
        }

        // Add tool results to messages for LLM
        const toolMessages: LLMMessage[] = [];

        // Add assistant message with tool calls and reasoning content if present
        const assistantMsg: any = {
          role: 'assistant' as const,
          content: '',
          toolCalls: response.toolCalls.map(tc => ({
            id: tc.id, name: tc.name, arguments: tc.arguments,
          })),
        };

        // Include reasoning_content for DeepSeek thinking mode
        if (response.reasoningContent) {
          assistantMsg.reasoningContent = response.reasoningContent;
        }

        toolMessages.push(assistantMsg);

        toolResults.forEach((result, index) => {
          toolMessages.push({
            role: 'tool' as const,
            content: JSON.stringify(result.result || { error: result.error }),
            toolCallId: response.toolCalls?.[index]?.id || `tool_call_${index}`,
          });
        });

        // Continue conversation with tool results
        const continuationMessages: LLMMessage[] = [...messages, ...toolMessages];

        this.logger.debug(`[ChatbotService] Sending ${continuationMessages.length} messages to LLM for tool result processing`);

        response = await this.llmService.generate(aiModel, continuationMessages, {
          temperature: config?.aiTemperature ?? 0.7,
          maxTokens: config?.aiMaxTokens ?? 2000,
        }, orgLLMConfig, undefined);

        finalContent = response.content;
      }
      // Also check for DSML tool calls in content (DeepSeek model outputs DSML format)
      else if (hasDSMLToolCalls(response.content)) {
        this.logger.log('[ChatbotService] Detected DSML tool calls in response content');
        detectedToolCalls = parseDSMLToolCalls(response.content);

        if (detectedToolCalls.length > 0) {
          this.logger.log(`[ChatbotService] Parsed ${detectedToolCalls.length} DSML tool calls`);

          // Execute each DSML tool call
          const toolResults: ToolResult[] = [];
          for (const toolCall of detectedToolCalls) {
            this.logger.log(`[ChatbotService] Executing DSML tool ${toolCall.name} with args: ${JSON.stringify(toolCall.arguments)}`);

            const result = await this.toolExecutor.executeTool(
              toolCall.name,
              toolCall.arguments,
              userId,
              organizationId
            );
            this.logger.log(`[ChatbotService] DSML Tool ${toolCall.name} result: success=${result.success}, error=${result.error}`);
            toolResults.push(result);

            // Collect references
            if (result.references) {
              allReferences.push(...result.references);
            }
          }

          // Add tool results to messages for LLM processing
          const toolMessages: LLMMessage[] = [];

          // Add assistant message with tool calls and reasoning content if present
          const assistantMsg: any = {
            role: 'assistant' as const,
            content: '',
            toolCalls: detectedToolCalls.map(tc => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
          };

          // Include reasoning_content for DeepSeek thinking mode
          if (response.reasoningContent) {
            assistantMsg.reasoningContent = response.reasoningContent;
          }

          toolMessages.push(assistantMsg);

          // Add tool result messages
          toolResults.forEach((result, index) => {
            toolMessages.push({
              role: 'tool' as const,
              content: JSON.stringify(result.result || { error: result.error }),
              toolCallId: detectedToolCalls[index]?.id || `tool_call_${index}`,
            });
          });

          // Continue conversation with tool results
          const continuationMessages: LLMMessage[] = [
            ...messages,
            ...toolMessages,
          ];

          this.logger.debug(`[ChatbotService] Sending ${continuationMessages.length} messages to LLM for DSML tool result processing`);

          // Generate final response with tool results
          response = await this.llmService.generate(aiModel, continuationMessages, {
            temperature: config?.aiTemperature ?? 0.7,
            maxTokens: config?.aiMaxTokens ?? 2000,
          }, orgLLMConfig, undefined);

          finalContent = response.content;
        } else {
          // Empty DSML block - just use the text content
          this.logger.warn('[ChatbotService] Empty DSML block detected, using text content');
          finalContent = cleanDSMLFromContent(response.content);
        }
      }

      // Clean DSML from final content if it wasn't already processed
      finalContent = cleanDSMLFromContent(finalContent);

      // Check for escalation keywords
      const shouldEscalate = this.checkEscalation(dto.content, config?.escalateKeywords);

      // Save assistant message
      const assistantMessage = await this.prisma.chatbotMessage.create({
        data: {
          sessionId: session.id,
          messageId: uuidv4(),
          role: 'assistant' as ChatMessageRole,
          content: finalContent,
          contentType: 'text' as ChatContentType,
          intent: shouldEscalate ? 'escalation_request' : null,
          aiModel: response.model,
          tokensUsed: response.tokensUsed,
          references: allReferences.length > 0 ? allReferences : undefined,
        },
      });

      // Log audit for AI response (message receive)
      const toolCallCount = (detectedToolCalls.length > 0 ? detectedToolCalls : response.toolCalls || []).length;
      this.auditService.logMessageReceive(
        assistantMessage.messageId,
        session.sessionId,
        organizationId,
        userId,
        {
          messageId: assistantMessage.messageId,
          sessionId: session.sessionId,
          contentLength: finalContent.length,
          intent: shouldEscalate ? 'escalation_request' : undefined,
          hasToolCalls: toolCallCount > 0,
          toolCallCount,
          references: allReferences.length > 0 ? allReferences : undefined,
        },
      ).catch((err) => this.logger.error('Failed to log message receive audit', { err }));

      // Log AI response generation stats if available
      if (response.tokensUsed) {
        this.auditService.logAIResponseGenerate(
          session.sessionId,
          organizationId,
          userId,
          finalContent.length,
          response.tokensUsed,
          0, // Duration not tracked here
          response.model,
        ).catch((err) => this.logger.error('Failed to log AI response audit', { err }));
      }

      // Update session
      await this.prisma.chatbotSession.update({
        where: { id: session.id },
        data: {
          messageCount: { increment: 1 },
          lastMessageAt: new Date(),
          status: shouldEscalate ? 'escalated' : session.status,
        },
      });

      return {
        messageId: assistantMessage.messageId,
        content: finalContent,
        contentType: 'text' as ChatContentType,
        intent: shouldEscalate ? 'escalation_request' : undefined,
        suggestedActions: shouldEscalate ? ['Connect with human agent'] : undefined,
        references: allReferences.length > 0 ? allReferences : undefined,
        sessionStatus: shouldEscalate ? 'escalated' : session.status,
        metadata: {
          aiModel: response.model,
        },
      };
    } catch (error: any) {
      this.logger.error(`LLM error: ${error?.message || error}`);
      this.logger.error(`Error stack: ${error?.stack}`);

      // Log AI error audit
      this.auditService.logAIError(
        session.sessionId,
        organizationId,
        userId,
        error.message || 'Unknown error',
        error.stack,
      ).catch((err) => this.logger.error('Failed to log AI error audit', { err }));

      // Return more specific error message based on error type
      let errorMessage = 'I apologize, but I encountered an error processing your request. Please try again.';

      if (error.message?.includes('401') || error.message?.includes('authentication')) {
        errorMessage = 'AI service authentication failed. Please check your API key configuration.';
      } else if (error.message?.includes('403') || error.message?.includes('forbidden')) {
        errorMessage = 'AI service access denied. Please verify your API key permissions.';
      } else if (error.message?.includes('429')) {
        errorMessage = 'AI service rate limit exceeded. Please try again in a moment.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'AI service request timed out. Please try again.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = `AI service error: ${error.response.data.error.message}`;
      } else if (error.message) {
        errorMessage = `AI service error: ${error.message}`;
      }

      // Return error message
      return {
        messageId: uuidv4(),
        content: errorMessage,
        contentType: 'text' as ChatContentType,
        metadata: {
          error: true,
          errorDetail: error.message,
        },
      };
    }
  }

  /**
   * Close a chat session
   */
  async closeSession(sessionId: string, userId: string, organizationId: string): Promise<{ success: boolean; summary?: string }> {
    const session = await this.prisma.chatbotSession.findFirst({
      where: {
        OR: [{ id: sessionId }, { sessionId }],
        organizationId,
        userId, // Ensure user can only close their own sessions
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.chatbotSession.update({
      where: { id: session.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Log audit for session closure
    this.auditService.logSessionClose(
      session.sessionId,
      organizationId,
      session.userId,
      {
        sessionId: session.sessionId,
        messageCount: session.messageCount,
        status: 'closed',
      },
    ).catch((err) => this.logger.error('Failed to log session close audit', { err }));

    return {
      success: true,
      summary: `Chat session closed. Total messages: ${session.messageCount}`,
    };
  }

  /**
   * Submit feedback for a message
   */
  async submitFeedback(
    messageId: string,
    organizationId: string,
    dto: MessageFeedbackDto,
  ): Promise<{ success: boolean }> {
    const message = await this.prisma.chatbotMessage.findFirst({
      where: {
        messageId,
        session: { organizationId },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.prisma.chatbotMessage.update({
      where: { id: message.id },
      data: {
        userFeedback: {
          helpful: dto.helpful,
          comment: dto.comment,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return { success: true };
  }

  /**
   * Get chatbot configuration
   */
  async getConfig(organizationId: string): Promise<ChatbotConfigResponseDto> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    let config = await this.prisma.chatbotConfig.findUnique({
      where: { organizationId },
    });

    if (!config) {
      config = await this.prisma.chatbotConfig.create({
        data: {
          organizationId,
        },
      });
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      aiModel: config.aiModel,
      aiTemperature: config.aiTemperature,
      aiMaxTokens: config.aiMaxTokens,
      aiApiKeyConfigured: !!config.aiApiKey,  // Only show if key is configured (don't expose the actual key)
      aiApiBaseUrl: config.aiApiBaseUrl || undefined,
      chatbotName: config.chatbotName,
      greetingMessage: config.greetingMessage,
      systemPrompt: config.systemPrompt ?? undefined,
      autoEscalateAfter: config.autoEscalateAfter,
      escalateKeywords: config.escalateKeywords,
      customFaqs: config.customFaqs,
      embeddingModel: (config as any).embeddingModel ?? undefined,
      embeddingBaseUrl: (config as any).embeddingBaseUrl ?? undefined,
      embeddingEnabled: (config as any).embeddingEnabled ?? true,
      reasoningEnabled: (config as any).reasoningEnabled ?? false,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update chatbot configuration
   */
  async updateConfig(
    organizationId: string,
    dto: UpdateChatbotConfigDto,
  ): Promise<ChatbotConfigResponseDto> {
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    const config = await this.prisma.chatbotConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...dto,
      },
      update: dto,
    });

    // Invalidate cache if AI settings changed
    if (dto.aiModel) {
      await this.licenseService.invalidateCache(organizationId);
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      aiModel: config.aiModel,
      aiTemperature: config.aiTemperature,
      aiMaxTokens: config.aiMaxTokens,
      aiApiKeyConfigured: !!config.aiApiKey,
      aiApiBaseUrl: config.aiApiBaseUrl || undefined,
      chatbotName: config.chatbotName,
      greetingMessage: config.greetingMessage,
      systemPrompt: config.systemPrompt ?? undefined,
      autoEscalateAfter: config.autoEscalateAfter,
      escalateKeywords: config.escalateKeywords,
      customFaqs: config.customFaqs,
      embeddingModel: (config as any).embeddingModel ?? undefined,
      embeddingBaseUrl: (config as any).embeddingBaseUrl ?? undefined,
      embeddingEnabled: (config as any).embeddingEnabled ?? true,
      reasoningEnabled: (config as any).reasoningEnabled ?? false,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async buildContext(organizationId: string, userId: string, enabledModules: string[]): Promise<ChatContextDto> {
    // Get user info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        tier: true,
        organizationUsers: {
          where: { organizationId },
          select: { orgRole: true },
          take: 1,
        },
      },
    });

    // Get open tickets count
    let openTicketsCount = 0;
    if (enabledModules.includes('tickets')) {
      openTicketsCount = await this.prisma.ticket.count({
        where: {
          organizationId,
          requesterId: userId,
          status: { notIn: ['resolved', 'closed'] },
        },
      });
    }

    // Get recent tickets
    let recentTickets: any[] = [];
    if (enabledModules.includes('tickets')) {
      const tickets = await this.prisma.ticket.findMany({
        where: {
          organizationId,
          requesterId: userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
        },
      });
      recentTickets = tickets;
    }

    return {
      userContext: {
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        orgRole: user?.organizationUsers[0]?.orgRole,
        tier: user?.tier,
      },
      enabledModules,
      openTicketsCount,
      recentTickets,
    };
  }

  private buildSystemPrompt(config: any, context: ChatContextDto): string {
    const promptConfig = this.promptConfig.getConfig();
    const orgName = promptConfig.systemPrompt.orgName;
    const chatbotName = config?.chatbotName || promptConfig.systemPrompt.chatbotName;

    // Build tools description from actual tool definitions
    const toolsDescription = this.buildToolsDescription(context.enabledModules || []);

    const customFaqSection = config?.customFaqs?.length > 0
      ? `\n\nCustom FAQs:\n${config.customFaqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n')}`
      : '';

    // Build guidelines section from config
    const guidelinesSection = promptConfig.guidelines
      .map((g, i) => `${i + 1}. ${g}`)
      .join('\n');

    // Build user context section
    const userContextSection = `- Name: ${context.userContext?.firstName || ''} ${context.userContext?.lastName || ''}
- Role: ${context.userContext?.orgRole || 'user'}
- Tier: ${context.userContext?.tier || 'standard'}
- Open tickets: ${context.openTicketsCount || 0}${context.recentTickets?.length ? `\nRecent tickets: ${context.recentTickets.map((t: any) => `${t.ticketNumber} (${t.status})`).join(', ')}` : ''}`;

    // Build ticket status info
    const ticketStatusSection = `\n\n${promptConfig.ticketStatusInfo.validStatuses.join(', ')}`;

    return `You are ${chatbotName}, ${promptConfig.systemPrompt.role}.

Your role is to help users:
- Find solutions using the knowledge base
- Create and track support tickets
- Browse and request services from the catalog
- Answer frequently asked questions
- Manage user and team information

Context about the user:
${userContextSection}

Guidelines:
${guidelinesSection}

Ticket Status Values:${ticketStatusSection}
${promptConfig.ticketStatusInfo.note}

${toolsDescription}${customFaqSection}
${config?.systemPrompt || ''}`.trim();
  }

  /**
   * Build a comprehensive description of available tools for the system prompt
   */
  private buildToolsDescription(enabledModules: string[]): string {
    const allTools = this.toolExecutor.getAllToolDefinitions();
    const availableTools = allTools.filter(tool => {
      if (!tool.requiredModules || tool.requiredModules.length === 0) return true;
      return tool.requiredModules.every(mod => enabledModules.includes(mod));
    });

    if (availableTools.length === 0) {
      return '';
    }

    const promptConfig = this.promptConfig.getConfig();
    const lines: string[] = [];

    // Group tools by category
    const byCategory = new Map<string, typeof availableTools>();
    for (const tool of availableTools) {
      const category = tool.category || 'Other';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(tool);
    }

    lines.push(`\n${promptConfig.toolsDescription.enabledMessage}`);

    for (const [category, tools] of byCategory) {
      lines.push(`\n## ${category}`);
      for (const tool of tools) {
        const params = Object.keys(tool.parameters || {});
        const paramStr = params.length > 0 ? `(${params.join(', ')})` : '';
        lines.push(`- ${tool.name}${paramStr}: ${tool.description}`);
      }
    }

    lines.push(`\n\n${promptConfig.toolsDescription.whenToUseHeader}`);
    for (const instruction of promptConfig.toolUsageInstructions) {
      lines.push(`- ${instruction}`);
    }

    return lines.join('\n');
  }

  private async getConversationHistory(sessionId: string): Promise<LLMMessage[]> {
    const messages = await this.prisma.chatbotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 30, // Limit context window
    });

    // Filter messages - skip system and any assistant messages with tool calls
    // Note: ChatMessageRole enum only has user, assistant, system (no 'tool')
    // Tool messages from LLM flow are not stored in DB, so we don't need to filter them
    return messages
      .filter((m) => {
        // Skip assistant messages that have tool calls (part of internal tool flow)
        if (m.role === 'assistant' && m.toolCalls) {
          this.logger.debug(`[ChatbotService] Skipping assistant message with tool_calls: ${m.id}`);
          return false;
        }
        return m.role !== 'system';
      })
      .map((m) => {
        const msg: LLMMessage = {
          role: m.role.toLowerCase() as 'user' | 'assistant',
          content: m.content,
        };

        return msg;
      });
  }

  /**
   * Convert tool definitions to LLM function format
   */
  private convertToolsToLLMFormat(tools: any[]): LLMFunctionTool[] {
    return tools.map(tool => {
      // Extract required fields from each parameter that has required: true
      const sourceParams = tool.parameters || {};
      const properties: Record<string, any> = {};
      const required: string[] = [];

      // Process each parameter - clean up the structure
      for (const [key, value] of Object.entries(sourceParams)) {
        // Check if required flag is set
        if (typeof value === 'object' && (value as any).required === true) {
          required.push(key);
        }

        // Create clean property without the 'required' field
        if (typeof value === 'object') {
          const { required: _, ...cleanValue } = value as any;
          properties[key] = cleanValue;
        } else {
          properties[key] = value;
        }
      }

      this.logger.debug(`[ChatbotService] Converted tool '${tool.name}': required fields = ${JSON.stringify(required)}, properties = ${JSON.stringify(properties)}`);

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      };
    });
  }

  private checkEscalation(content: string, keywords?: string[]): boolean {
    const defaultKeywords = ['human', 'agent', 'real person', 'live chat', 'speak to someone'];
    const searchKeywords = keywords || defaultKeywords;
    const lowerContent = content.toLowerCase();

    return searchKeywords.some((keyword) => lowerContent.includes(keyword.toLowerCase()));
  }
}