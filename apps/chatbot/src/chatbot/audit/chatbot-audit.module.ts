import { Module, Global } from '@nestjs/common';
import { ChatbotAuditService } from './chatbot-audit.service';

/**
 * Chatbot Audit Module
 *
 * Provides global audit logging service for all chatbot components.
 * Marked as @Global() so ChatbotAuditService is available everywhere
 * without explicit imports.
 */
@Global()
@Module({
  providers: [ChatbotAuditService],
  exports: [ChatbotAuditService],
})
export class ChatbotAuditModule {}