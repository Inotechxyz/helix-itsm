/**
 * Chatbot Audit Types
 *
 * Defines audit log data structures for chatbot activities
 */

/**
 * Audit actions for chatbot activities
 */
export enum ChatbotAuditAction {
  // Session actions
  SESSION_CREATE = 'CHATBOT_SESSION_CREATE',
  SESSION_CLOSE = 'CHATBOT_SESSION_CLOSE',
  SESSION_UPDATE = 'CHATBOT_SESSION_UPDATE',

  // Message actions
  MESSAGE_SEND = 'CHATBOT_MESSAGE_SEND',
  MESSAGE_RECEIVE = 'CHATBOT_MESSAGE_RECEIVE',
  MESSAGE_ESCALATE = 'CHATBOT_MESSAGE_ESCALATE',

  // Tool actions
  TOOL_EXECUTE = 'CHATBOT_TOOL_EXECUTE',
  TOOL_FAILED = 'CHATBOT_TOOL_FAILED',
  TOOL_ACCESS_DENIED = 'CHATBOT_TOOL_ACCESS_DENIED',

  // AI actions
  AI_RESPONSE_GENERATE = 'CHATBOT_AI_RESPONSE_GENERATE',
  AI_ERROR = 'CHATBOT_AI_ERROR',

  // Configuration
  CONFIG_UPDATE = 'CHATBOT_CONFIG_UPDATE',
}

/**
 * Entity types for chatbot audit logs
 */
export enum ChatbotAuditEntityType {
  SESSION = 'chatbot_sessions',
  MESSAGE = 'chatbot_messages',
  TOOL = 'chatbot_tools',
  CONFIG = 'chatbot_config',
  AI_INTERACTION = 'chatbot_ai_interactions',
}

/**
 * Chatbot audit log data structure
 */
export interface ChatbotAuditLogData {
  action: ChatbotAuditAction | string;
  entityType: ChatbotAuditEntityType | string;
  entityId: string;
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  method?: string;
  path?: string;
  ipAddress?: string;
  userAgent?: string;
  executionTimeMs?: number;
  statusCode?: number;
}

/**
 * Tool execution audit metadata
 */
export interface ToolExecutionAuditMetadata {
  toolName: string;
  parameters: Record<string, any>;
  result?: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  aiModel?: string;
  tokensUsed?: number;
}

/**
 * Session audit metadata
 */
export interface SessionAuditMetadata {
  sessionId: string;
  messageCount: number;
  status?: string;
  duration?: number;
  userAgent?: string;
}

/**
 * Message audit metadata
 */
export interface MessageAuditMetadata {
  messageId: string;
  sessionId: string;
  contentLength: number;
  intent?: string;
  hasToolCalls: boolean;
  toolCallCount: number;
  references?: any[];
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
  }>;
}