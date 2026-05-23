/**
 * Chatbot Prompt Configuration Module
 *
 * Provides configuration service for chatbot prompt templates.
 * Allows customization without code changes.
 */

import { Module, Global } from '@nestjs/common';
import { ChatbotPromptConfigService } from './chatbot-prompt-config.service';

@Global()
@Module({
  providers: [ChatbotPromptConfigService],
  exports: [ChatbotPromptConfigService],
})
export class ChatbotPromptConfigModule {}