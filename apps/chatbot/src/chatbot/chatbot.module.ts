import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { LLMService } from './llm/llm.service';
import { ToolsModule } from './tools/tools.module';
import { ChatbotLicenseModule } from './chatbot-license.module';
import { ChatbotAuditModule } from './audit/chatbot-audit.module';

@Module({
  imports: [ChatbotLicenseModule, ToolsModule, ChatbotAuditModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    LLMService,
  ],
  exports: [ChatbotService],
})
export class ChatbotModule {}