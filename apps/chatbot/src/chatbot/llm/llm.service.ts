import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * LLM Message interface
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // For tool role messages
  toolCallId?: string; // Required for tool role messages
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string | Record<string, any>;
  }>; // For assistant messages with tool calls
}

/**
 * Tool definition for LLM function calling
 */
export interface LLMFunctionTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required?: string[];
  };
}

/**
 * Tool call from LLM
 */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string | Record<string, any>;
}

/**
 * Tool execution result
 */
export interface LLMFunctionResult {
  toolCallId: string;
  toolName: string;
  result: any;
  success: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error' | 'tool_calls';
  toolCalls?: LLMToolCall[];
  reasoningContent?: string; // DeepSeek thinking mode content
}

export interface LLMStreamResponse {
  content: string;
  done: boolean;
  model: string;
  tokensUsed?: number;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stop?: string[];
}

/**
 * LLM Configuration for organization
 */
export interface OrgLLMConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  reasoningEnabled?: boolean;
}

/**
 * Simple LLM Service that supports multiple providers
 * Supports both global (system) and per-organization API keys
 */
@Injectable()
export class LLMService {
  private logger = new Logger(LLMService.name);

  // Model to provider mapping
  private modelProviders: Record<string, string> = {
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    'gpt-4-turbo': 'openai',
    'gpt-4': 'openai',
    'claude-3-5-sonnet': 'anthropic',
    'claude-3-5-haiku': 'anthropic',
    'claude-3-opus': 'anthropic',
    'deepseek-chat': 'deepseek',
    'deepseek-coder': 'deepseek',
    'abab6.5s-chat': 'minimax',
    'abab6-chat': 'minimax',
  };

  constructor(private config: ConfigService) {}

  /**
   * Detect provider from model name
   */
  private getProvider(model: string): string {
    return this.modelProviders[model] || 'openai';
  }

  /**
   * Get system-wide API key for provider (fallback)
   */
  private getSystemApiKey(provider: string): string | undefined {
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
   * Get system-wide base URL for provider (fallback)
   */
  private getSystemBaseUrl(provider: string): string {
    switch (provider) {
      case 'openai':
        return this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
      case 'anthropic':
        return this.config.get<string>('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com/v1';
      case 'deepseek':
        return this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
      case 'minimax':
        return this.config.get<string>('MINIMAX_BASE_URL') || 'https://api.minimax.chat/v1';
      default:
        return this.config.get<string>('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
    }
  }

  /**
   * Generate response from LLM
   * @param model - Model name (e.g., gpt-4o-mini, claude-3-5-sonnet)
   * @param messages - Chat messages
   * @param options - Generation options
   * @param orgConfig - Optional organization-specific config (API key, base URL)
   * @param tools - Optional array of tool definitions for function calling
   */
  async generate(
    model: string,
    messages: LLMMessage[],
    options?: LLMOptions,
    orgConfig?: OrgLLMConfig,
    tools?: LLMFunctionTool[]
  ): Promise<LLMResponse> {
    const provider = this.getProvider(model);

    // Priority: org-specific config > system config
    const apiKey = orgConfig?.apiKey || this.getSystemApiKey(provider);
    const baseUrl = orgConfig?.baseUrl || this.getSystemBaseUrl(provider);

    if (!apiKey) {
      this.logger.warn(`${provider} API key not configured (org or system)`);
      return {
        content: 'AI service is not configured. Please contact your administrator.',
        model,
        finishReason: 'error',
      };
    }

    try {
      // Build request based on provider
      if (provider === 'anthropic') {
        return await this.generateAnthropic(model, messages, options, apiKey, tools);
      } else {
        return await this.generateOpenAICompatible(model, messages, options, apiKey, baseUrl, tools, orgConfig?.reasoningEnabled);
      }
    } catch (error: any) {
      this.logger.error(`LLM generation error: ${error?.message || error}`);
      this.logger.error(`LLM error details: ${JSON.stringify(error?.response?.data)}`);
      this.logger.error(`LLM error status: ${error?.response?.status}`);
      this.logger.error(`LLM error headers: ${JSON.stringify(error?.response?.headers)}`);
      return {
        content: 'I encountered an error processing your request. Please try again.',
        model,
        finishReason: 'error',
      };
    }
  }

  /**
   * Generate using OpenAI-compatible API with function calling support
   */
  private async generateOpenAICompatible(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions | undefined,
    apiKey: string,
    baseUrl: string,
    tools?: LLMFunctionTool[],
    reasoningEnabled?: boolean
  ): Promise<LLMResponse> {
    // Transform messages to OpenAI format
    const formattedMessages = messages.map(msg => {
      const formatted: any = {
        role: msg.role,
        content: msg.content,
      };

      // Add name for tool role messages (optional but helps identify the tool)
      if (msg.role === 'tool' && msg.name) {
        formatted.name = msg.name;
      }

      // Add tool_call_id for tool role messages (required)
      if (msg.role === 'tool' && msg.toolCallId) {
        formatted.tool_call_id = msg.toolCallId;
      }

      // Add tool_calls for assistant messages (when returning tool call results)
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        formatted.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
          },
        }));
      }

      // Include reasoning_content for DeepSeek thinking mode (when passing back assistant response)
      if (msg.role === 'assistant' && (msg as any).reasoningContent) {
        formatted.reasoning_content = (msg as any).reasoningContent;
      }

      return formatted;
    });

    const requestBody: any = {
      model,
      messages: formattedMessages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      top_p: options?.topP,
      stop: options?.stop,
    };

    // Add reasoning configuration for DeepSeek thinking mode
    if (reasoningEnabled && model.includes('deepseek')) {
      requestBody.reasoning = { type: 'enabled' };
      this.logger.log('[LLMService] DeepSeek reasoning mode enabled');
    }

    // Add tools if provided (for function calling)
    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      requestBody.tool_choice = 'auto';
      this.logger.log(`[LLMService] Sending request with ${tools.length} tools`);
      this.logger.debug(`[LLMService] Tools payload: ${JSON.stringify(requestBody.tools, null, 2)}`);
    }

    this.logger.debug(`[LLMService] Request body: ${JSON.stringify(requestBody, (key, value) => {
      // Mask API key in logs
      if (key === 'Authorization') return '[REDACTED]';
      return value;
    }, 2)}`);

    const response = await axios.post(`${baseUrl}/chat/completions`, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.logger.debug(`[LLMService] Response data: ${JSON.stringify(response.data, null, 2).substring(0, 2000)}`);

    const choice = response.data.choices[0];

    // Check if there are tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      this.logger.log(`[LLMService] Found ${choice.message.tool_calls.length} tool calls in response`);

      for (const tc of choice.message.tool_calls) {
        this.logger.log(`[LLMService] Tool call: name=${tc.function?.name}, arguments type=${typeof tc.function?.arguments}`);
        this.logger.log(`[LLMService] Tool call arguments: ${JSON.stringify(tc.function?.arguments)}`);
      }

      const toolCalls: LLMToolCall[] = choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return {
        content: choice.message.content || '',
        model,
        tokensUsed: response.data.usage?.total_tokens,
        finishReason: 'tool_calls',
        toolCalls,
        reasoningContent: choice.message.reasoning_content || undefined,
      };
    }

    return {
      content: choice.message.content || '',
      model,
      tokensUsed: response.data.usage?.total_tokens,
      finishReason: choice.finish_reason || 'stop',
      reasoningContent: choice.message.reasoning_content || undefined,
    };
  }

  /**
   * Generate using Anthropic API with function calling support
   */
  private async generateAnthropic(
    model: string,
    messages: LLMMessage[],
    options: LLMOptions | undefined,
    apiKey: string,
    tools?: LLMFunctionTool[]
  ): Promise<LLMResponse> {
    // Anthropic uses a different format for tools
    const toolDefinitions = tools?.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    })) || [];

    // For now, we'll use the standard text generation (Anthropic tool use is more complex)
    // Convert messages format for Anthropic
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const anthropicModel = model.replace('claude-', 'claude-');

    const requestBody: any = {
      model: anthropicModel,
      messages: conversationMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      system: systemMessage?.content,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    };

    // Add tools for Claude
    if (toolDefinitions.length > 0) {
      requestBody.tools = toolDefinitions;
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', requestBody, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
    });

    // Check for tool use in response
    if (response.data.content && response.data.content.some((c: any) => c.type === 'tool_use')) {
      const toolCalls: LLMToolCall[] = response.data.content
        .filter((c: any) => c.type === 'tool_use')
        .map((c: any, index: number) => ({
          id: `tool_${index}`,
          name: c.name,
          arguments: c.input,
        }));

      return {
        content: response.data.content.filter((c: any) => c.type === 'text')[0]?.text || '',
        model,
        tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens,
        finishReason: 'tool_calls',
        toolCalls,
      };
    }

    return {
      content: response.data.content[0].text,
      model,
      tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens,
      finishReason: response.data.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  /**
   * Generate tool call results message for continuing conversation
   */
  generateToolResultMessage(
    results: LLMFunctionResult[]
  ): LLMMessage[] {
    return results.map(result => ({
      role: 'tool' as const,
      toolCallId: result.toolCallId,
      name: result.toolName,
      content: JSON.stringify(result.result),
    }));
  }

  /**
   * Stream response from LLM (simplified - returns single response)
   */
  async stream(
    model: string,
    messages: LLMMessage[],
    options?: LLMOptions,
    orgConfig?: OrgLLMConfig
  ): Promise<AsyncGenerator<LLMStreamResponse>> {
    const response = await this.generate(model, messages, options, orgConfig);

    const generateStream = async function* (): AsyncGenerator<LLMStreamResponse> {
      yield {
        content: response.content,
        done: true,
        model: response.model,
        tokensUsed: response.tokensUsed,
      };
    };

    return generateStream();
  }
}