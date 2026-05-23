/**
 * Chatbot Prompt Configuration Service
 *
 * Loads and serves chatbot prompt templates from configuration files.
 * Allows customization without code changes.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface ChatbotPromptConfig {
  systemPrompt: {
    chatbotName: string;
    orgName: string;
    role: string;
  };
  guidelines: string[];
  toolUsageInstructions: string[];
  ticketStatusInfo: {
    validStatuses: string[];
    note: string;
  };
  toolsDescription: {
    enabledMessage: string;
    whenToUseHeader: string;
  };
}

@Injectable()
export class ChatbotPromptConfigService {
  private readonly logger = new Logger(ChatbotPromptConfigService.name);
  private config: ChatbotPromptConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  /**
   * Load configuration from JSON file
   */
  private loadConfig(): void {
    try {
      const configPath = path.join(__dirname, 'chatbot-prompt-template.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);
      this.logger.log('Chatbot prompt template configuration loaded successfully');
    } catch (error: any) {
      this.logger.error(`Failed to load chatbot prompt config: ${error.message}`);
      // Use default config if file not found
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Get the default configuration
   */
  private getDefaultConfig(): ChatbotPromptConfig {
    return {
      systemPrompt: {
        chatbotName: 'Helix Assistant',
        orgName: 'your organization',
        role: 'an AI assistant for {orgName}\'s helpdesk system',
      },
      guidelines: [
        'Be helpful, concise, and professional',
        'If you can find a knowledge base article that answers the question, suggest it',
        'For ticket creation, ask for required information if not provided',
        'For adding comments to tickets, you MUST know the ticket number/ID - ask user if not provided',
        'Keep responses friendly and actionable',
        'If you cannot help with something, suggest contacting human support',
      ],
      toolUsageInstructions: [
        'Use tools to retrieve real-time data from the system',
        'Use search tools when user asks about tickets, articles, or services',
        'Use create/update tools when user wants to make changes',
        'If a tool fails, explain the error to the user and suggest alternatives',
        'ALWAYS ask the user for required parameters if not provided (e.g., ticket number for comments)',
        'Do NOT output empty DSML blocks - either call tools properly or respond with text',
        'If user wants to add a comment, ask for the ticket number if not clear from context',
      ],
      ticketStatusInfo: {
        validStatuses: ['new', 'assigned', 'in_progress', 'pending', 'resolved', 'closed'],
        note: 'Note: "open" is NOT a valid status - use get_my_open_tickets instead for open tickets',
      },
      toolsDescription: {
        enabledMessage: 'AVAILABLE TOOLS (you can call these to help the user):',
        whenToUseHeader: 'When to use tools:',
      },
    };
  }

  /**
   * Get the full configuration
   */
  getConfig(): ChatbotPromptConfig {
    return this.config || this.getDefaultConfig();
  }

  /**
   * Get system prompt sections
   */
  getSystemPrompt(): ChatbotPromptConfig['systemPrompt'] {
    return this.config?.systemPrompt || this.getDefaultConfig().systemPrompt;
  }

  /**
   * Get guidelines
   */
  getGuidelines(): string[] {
    return this.config?.guidelines || this.getDefaultConfig().guidelines;
  }

  /**
   * Get tool usage instructions
   */
  getToolUsageInstructions(): string[] {
    return this.config?.toolUsageInstructions || this.getDefaultConfig().toolUsageInstructions;
  }

  /**
   * Get ticket status info
   */
  getTicketStatusInfo(): ChatbotPromptConfig['ticketStatusInfo'] {
    return this.config?.ticketStatusInfo || this.getDefaultConfig().ticketStatusInfo;
  }

  /**
   * Get tools description config
   */
  getToolsDescriptionConfig(): ChatbotPromptConfig['toolsDescription'] {
    return this.config?.toolsDescription || this.getDefaultConfig().toolsDescription;
  }

  /**
   * Reload configuration from file (useful for runtime updates)
   */
  reloadConfig(): void {
    this.loadConfig();
    this.logger.log('Chatbot prompt configuration reloaded');
  }
}