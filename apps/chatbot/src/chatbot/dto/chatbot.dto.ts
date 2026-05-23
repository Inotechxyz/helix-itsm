import { IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// Enum arrays for Swagger documentation
export const ChatContentTypeEnum = ['text', 'rich', 'quick_reply', 'card'] as const;
export const ChatMessageRoleEnum = ['user', 'assistant', 'system'] as const;
export const ChatbotSessionStatusEnum = ['active', 'awaiting_response', 'escalated', 'resolved', 'closed'] as const;

export type ChatContentType = typeof ChatContentTypeEnum[number];
export type ChatMessageRole = typeof ChatMessageRoleEnum[number];
export type ChatbotSessionStatus = typeof ChatbotSessionStatusEnum[number];

// ============================================
// Session DTOs
// ============================================

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Optional session context' })
  @IsOptional()
  @IsString()
  context?: string;
}

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ enum: ChatbotSessionStatusEnum })
  status!: ChatbotSessionStatus;

  @ApiPropertyOptional()
  userEmail?: string;

  @ApiPropertyOptional()
  userFirstName?: string;

  @ApiPropertyOptional()
  userLastName?: string;

  @ApiProperty()
  messageCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  lastMessageAt?: Date;
}

// ============================================
// Message DTOs (declared first to avoid forward reference)
// ============================================

export class ChatMessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  messageId!: string;

  @ApiProperty({ enum: ChatMessageRoleEnum })
  role!: ChatMessageRole;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ChatContentTypeEnum })
  contentType!: ChatContentType;

  @ApiPropertyOptional()
  intent?: string;

  @ApiPropertyOptional()
  aiModel?: string;

  @ApiPropertyOptional()
  tokensUsed?: number;

  @ApiPropertyOptional()
  toolCalls?: any;

  @ApiPropertyOptional()
  references?: any;

  @ApiPropertyOptional()
  userFeedback?: any;

  @ApiProperty()
  createdAt!: Date;
}

// Session with messages (after ChatMessageDto declaration)
export class SessionWithMessagesDto extends SessionResponseDto {
  @ApiProperty({ type: [ChatMessageDto] })
  messages!: ChatMessageDto[];
}

// ============================================
// Message Request DTOs
// ============================================

// Attachment DTO for send message (declared before SendMessageDto)
export class SendMessageAttachmentDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsNumber()
  size!: number;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;
}

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ description: 'Attachments metadata' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendMessageAttachmentDto)
  attachments?: SendMessageAttachmentDto[];

  @ApiPropertyOptional({ description: 'Optional metadata' })
  @IsOptional()
  metadata?: {
    context?: string;
    relatedItemId?: string;
  };
}

export class MessageResponseDto {
  @ApiProperty()
  messageId!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ChatContentTypeEnum })
  contentType!: ChatContentType;

  @ApiPropertyOptional()
  intent?: string;

  @ApiPropertyOptional()
  references?: any[];

  @ApiPropertyOptional()
  suggestedActions?: string[];

  @ApiPropertyOptional()
  sessionStatus?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, any>;
}

export class StreamMessageDto extends SendMessageDto {
  @ApiPropertyOptional({ description: 'Stream response', default: true })
  @IsOptional()
  @IsBoolean()
  stream?: boolean = true;
}

// ============================================
// Chatbot Config DTOs
// ============================================

export class UpdateChatbotConfigDto {
  @ApiPropertyOptional({ description: 'AI model to use' })
  @IsOptional()
  @IsString()
  aiModel?: string;

  @ApiPropertyOptional({ description: 'AI temperature (0-1)' })
  @IsOptional()
  @IsNumber()
  aiTemperature?: number;

  @ApiPropertyOptional({ description: 'Max tokens for response' })
  @IsOptional()
  @IsNumber()
  aiMaxTokens?: number;

  @ApiPropertyOptional({ description: 'Custom API key for this organization (optional)' })
  @IsOptional()
  @IsString()
  aiApiKey?: string;

  @ApiPropertyOptional({ description: 'Custom API base URL (for proxies or self-hosted models)' })
  @IsOptional()
  @IsString()
  aiApiBaseUrl?: string;

  @ApiPropertyOptional({ description: 'Chatbot name' })
  @IsOptional()
  @IsString()
  chatbotName?: string;

  @ApiPropertyOptional({ description: 'Greeting message' })
  @IsOptional()
  @IsString()
  greetingMessage?: string;

  @ApiPropertyOptional({ description: 'Custom system prompt' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Auto-escalate after N messages' })
  @IsOptional()
  @IsNumber()
  autoEscalateAfter?: number;

  @ApiPropertyOptional({ description: 'Escalation keywords' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  escalateKeywords?: string[];

  @ApiPropertyOptional({ description: 'Custom FAQs' })
  @IsOptional()
  customFaqs?: Array<{ question: string; answer: string }>;

  @ApiPropertyOptional({ description: 'Embedding model for semantic search (e.g., text-embedding-3-small, deepseek-embedding-v1)' })
  @IsOptional()
  @IsString()
  embeddingModel?: string;

  @ApiPropertyOptional({ description: 'Custom embedding API base URL (for proxies or self-hosted models)' })
  @IsOptional()
  @IsString()
  embeddingBaseUrl?: string;

  @ApiPropertyOptional({ description: 'Enable knowledge base semantic search' })
  @IsOptional()
  @IsBoolean()
  embeddingEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable DeepSeek thinking/reasoning mode' })
  @IsOptional()
  @IsBoolean()
  reasoningEnabled?: boolean;
}

export class ChatbotConfigResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  aiModel!: string;

  @ApiProperty()
  aiTemperature!: number;

  @ApiProperty()
  aiMaxTokens!: number;

  @ApiPropertyOptional()
  aiApiKeyConfigured?: boolean;  // Whether custom API key is set (not exposing actual key)

  @ApiPropertyOptional()
  aiApiBaseUrl?: string;  // Custom base URL (can be empty)

  @ApiProperty()
  chatbotName!: string;

  @ApiProperty()
  greetingMessage!: string;

  @ApiPropertyOptional()
  systemPrompt?: string;

  @ApiProperty()
  autoEscalateAfter!: number;

  @ApiProperty({ type: [String] })
  escalateKeywords!: string[];

  @ApiPropertyOptional()
  customFaqs?: any;

  @ApiPropertyOptional()
  embeddingModel?: string;

  @ApiPropertyOptional()
  embeddingBaseUrl?: string;

  @ApiPropertyOptional()
  embeddingEnabled?: boolean;

  @ApiPropertyOptional()
  reasoningEnabled?: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

// ============================================
// Feedback DTOs
// ============================================

export class MessageFeedbackDto {
  @ApiProperty({ description: 'Was the response helpful?' })
  @IsBoolean()
  helpful!: boolean;

  @ApiPropertyOptional({ description: 'Optional comment' })
  @IsOptional()
  @IsString()
  comment?: string;
}

// ============================================
// Context DTOs
// ============================================

export class ChatContextDto {
  @ApiPropertyOptional({ description: 'User context' })
  userContext?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    orgRole?: string;
    tier?: string;
  };

  @ApiPropertyOptional({ description: 'Enabled modules' })
  enabledModules?: string[];

  @ApiPropertyOptional({ description: 'Open tickets count' })
  openTicketsCount?: number;

  @ApiPropertyOptional({ description: 'Recent tickets' })
  recentTickets?: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
  }>;
}