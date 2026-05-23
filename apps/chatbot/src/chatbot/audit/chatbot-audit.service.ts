import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  ChatbotAuditLogData,
  ChatbotAuditAction,
  ChatbotAuditEntityType,
  ToolExecutionAuditMetadata,
  SessionAuditMetadata,
  MessageAuditMetadata,
} from './chatbot-audit.types';

/**
 * Chatbot Audit Service
 *
 * Handles audit logging for chatbot activities including:
 * - Session creation/closure
 * - Message processing
 * - Tool execution
 * - AI interactions
 *
 * Writes to the shared AuditLog table used by the API app
 */
@Injectable()
export class ChatbotAuditService {
  private readonly logger = new Logger(ChatbotAuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log a generic audit event
   */
  async log(data: ChatbotAuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          organizationId: data.organizationId,
          userId: data.userId,
          userEmail: data.userEmail,
          userRole: data.userRole,
          changes: data.changes ? JSON.parse(JSON.stringify(data.changes)) : undefined,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
          method: data.method,
          path: data.path,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          executionTimeMs: data.executionTimeMs,
          statusCode: data.statusCode,
        },
      });

      this.logger.debug(`[ChatbotAudit] Logged: ${data.action} for ${data.entityType}:${data.entityId}`);
    } catch (error) {
      // Log error but don't throw - audit failures shouldn't break chatbot operations
      this.logger.error(`[ChatbotAudit] Failed to write audit log`, { error, data });
    }
  }

  /**
   * Log session creation
   */
  async logSessionCreate(
    sessionId: string,
    organizationId: string,
    userId: string,
    userEmail?: string,
    metadata?: SessionAuditMetadata,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.SESSION_CREATE,
      entityType: ChatbotAuditEntityType.SESSION,
      entityId: sessionId,
      organizationId,
      userId,
      userEmail,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      statusCode: 201,
    });
  }

  /**
   * Log session closure
   */
  async logSessionClose(
    sessionId: string,
    organizationId: string,
    userId: string,
    metadata?: SessionAuditMetadata,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.SESSION_CLOSE,
      entityType: ChatbotAuditEntityType.SESSION,
      entityId: sessionId,
      organizationId,
      userId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      statusCode: 200,
    });
  }

  /**
   * Log message sent by user
   */
  async logMessageSend(
    messageId: string,
    sessionId: string,
    organizationId: string,
    userId: string,
    userEmail?: string,
    metadata?: MessageAuditMetadata,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.MESSAGE_SEND,
      entityType: ChatbotAuditEntityType.MESSAGE,
      entityId: messageId,
      organizationId,
      userId,
      userEmail,
      changes: { sessionId },
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      statusCode: 200,
    });
  }

  /**
   * Log AI response generated
   */
  async logMessageReceive(
    messageId: string,
    sessionId: string,
    organizationId: string,
    userId: string,
    metadata?: MessageAuditMetadata,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.MESSAGE_RECEIVE,
      entityType: ChatbotAuditEntityType.MESSAGE,
      entityId: messageId,
      organizationId,
      userId,
      changes: { sessionId },
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      statusCode: 200,
    });
  }

  /**
   * Log tool execution (success)
   */
  async logToolExecution(
    sessionId: string,
    organizationId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>,
    result: Record<string, any>,
    durationMs: number,
    metadata?: Partial<ToolExecutionAuditMetadata>,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.TOOL_EXECUTE,
      entityType: ChatbotAuditEntityType.TOOL,
      entityId: `${sessionId}:${toolName}:${Date.now()}`,
      organizationId,
      userId,
      changes: {
        toolName,
        parameters,
        result,
      },
      metadata: {
        toolName,
        parameters,
        result,
        success: true,
        durationMs,
        ...metadata,
      } as any,
      executionTimeMs: durationMs,
      statusCode: 200,
    });

    this.logger.log(`[ChatbotAudit] Tool executed: ${toolName} in ${durationMs}ms`);
  }

  /**
   * Log tool execution failure
   */
  async logToolFailed(
    sessionId: string,
    organizationId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>,
    errorMessage: string,
    durationMs: number,
    metadata?: Partial<ToolExecutionAuditMetadata>,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.TOOL_FAILED,
      entityType: ChatbotAuditEntityType.TOOL,
      entityId: `${sessionId}:${toolName}:${Date.now()}`,
      organizationId,
      userId,
      changes: {
        toolName,
        parameters,
        error: errorMessage,
      },
      metadata: {
        toolName,
        parameters,
        success: false,
        errorMessage,
        durationMs,
        ...metadata,
      } as any,
      executionTimeMs: durationMs,
      statusCode: 500,
    });

    this.logger.warn(`[ChatbotAudit] Tool failed: ${toolName} - ${errorMessage}`);
  }

  /**
   * Log tool access denied (user doesn't have permission)
   */
  async logToolAccessDenied(
    sessionId: string,
    organizationId: string,
    userId: string,
    toolName: string,
    reason: string,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.TOOL_ACCESS_DENIED,
      entityType: ChatbotAuditEntityType.TOOL,
      entityId: `${sessionId}:${toolName}:${Date.now()}`,
      organizationId,
      userId,
      changes: {
        toolName,
        reason,
      },
      metadata: {
        toolName,
        reason,
        success: false,
      } as any,
      statusCode: 403,
    });

    this.logger.warn(`[ChatbotAudit] Tool access denied: ${toolName} - ${reason}`);
  }

  /**
   * Log AI error
   */
  async logAIError(
    sessionId: string,
    organizationId: string,
    userId: string,
    errorMessage: string,
    errorDetail?: string,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.AI_ERROR,
      entityType: ChatbotAuditEntityType.AI_INTERACTION,
      entityId: `${sessionId}:${Date.now()}`,
      organizationId,
      userId,
      metadata: {
        errorMessage,
        errorDetail,
      } as any,
      statusCode: 500,
    });

    this.logger.error(`[ChatbotAudit] AI error: ${errorMessage}`);
  }

  /**
   * Log AI response generation
   */
  async logAIResponseGenerate(
    sessionId: string,
    organizationId: string,
    userId: string,
    responseLength: number,
    tokensUsed: number,
    durationMs: number,
    aiModel: string,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.AI_RESPONSE_GENERATE,
      entityType: ChatbotAuditEntityType.AI_INTERACTION,
      entityId: `${sessionId}:${Date.now()}`,
      organizationId,
      userId,
      metadata: {
        responseLength,
        tokensUsed,
        durationMs,
        aiModel,
      } as any,
      executionTimeMs: durationMs,
      statusCode: 200,
    });
  }

  /**
   * Log message escalation
   */
  async logMessageEscalate(
    messageId: string,
    sessionId: string,
    organizationId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.log({
      action: ChatbotAuditAction.MESSAGE_ESCALATE,
      entityType: ChatbotAuditEntityType.MESSAGE,
      entityId: messageId,
      organizationId,
      userId,
      changes: {
        sessionId,
        reason,
      },
      metadata: {
        sessionId,
        reason,
      } as any,
      statusCode: 200,
    });

    this.logger.log(`[ChatbotAudit] Message escalated: ${reason}`);
  }
}