import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ChatbotAuditService } from '../audit/chatbot-audit.service';
import {
  ToolRegistry,
  BaseToolPlugin,
  ToolDefinition,
  ToolContext,
  ToolResult,
} from './base-tool.interface';
import { TicketsToolPlugin } from './modules/tickets.tool';
import { KnowledgeBaseToolPlugin } from './modules/knowledge-base.tool';
import { ServiceCatalogToolPlugin } from './modules/service-catalog.tool';
import { UsersToolPlugin } from './modules/users.tool';

// Re-export for external use
export type { ToolResult } from './base-tool.interface';

/**
 * Tool result with optional metadata
 */
export interface ToolExecutionResult extends ToolResult {
  toolCallId?: string;
  duration?: number;
}

/**
 * Tool Executor Service - Manages all tool plugins and executes tools
 *
 * Architecture:
 * - Each module has its own plugin class (e.g., TicketsToolPlugin)
 * - Plugins are registered with the ToolRegistry
 * - The executor uses the registry to find and execute tools
 * - Access control is based on organization license modules
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);
  private readonly registry: ToolRegistry;

  constructor(
    private prisma: PrismaService,
    private auditService: ChatbotAuditService,
    private ticketsPlugin: TicketsToolPlugin,
    private kbPlugin: KnowledgeBaseToolPlugin,
    private serviceCatalogPlugin: ServiceCatalogToolPlugin,
    private usersPlugin: UsersToolPlugin,
  ) {
    this.registry = new ToolRegistry();
    this.registerPlugins();
    this.logger.log('ToolExecutorService initialized with plugins');
    this.logAvailableTools();
  }

  /**
   * Register all tool plugins
   */
  private registerPlugins(): void {
    // Register plugins in order
    this.registry.register(this.ticketsPlugin);
    this.registry.register(this.kbPlugin);
    this.registry.register(this.serviceCatalogPlugin);
    this.registry.register(this.usersPlugin);

    this.logger.log(`Registered ${this.getPlugins().length} tool plugins`);
  }

  /**
   * Log available tools at startup
   */
  private logAvailableTools(): void {
    const tools = this.getAllToolDefinitions();
    const byCategory = new Map<string, string[]>();

    for (const tool of tools) {
      const existing = byCategory.get(tool.category) || [];
      existing.push(tool.name);
      byCategory.set(tool.category, existing);
    }

    this.logger.log('Available tools by category:');
    for (const [category, toolNames] of byCategory) {
      this.logger.log(`  ${category}: ${toolNames.join(', ')}`);
    }
  }

  /**
   * Get all registered plugin instances
   */
  private getPlugins(): BaseToolPlugin[] {
    return [
      this.ticketsPlugin,
      this.kbPlugin,
      this.serviceCatalogPlugin,
      this.usersPlugin,
    ];
  }

  /**
   * Get enabled modules for an organization from license
   */
  private async getEnabledModules(organizationId: string): Promise<string[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { licenseToken: true },
    });

    if (!org?.licenseToken) {
      return ['tickets', 'service_catalog']; // Default modules
    }

    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(org.licenseToken) as any;

      if (!payload) return ['tickets', 'service_catalog'];

      // Module definitions by tier
      const TIER_MODULES: Record<string, string[]> = {
        basic: ['tickets', 'service_catalog'],
        standard: ['tickets', 'problems', 'knowledge_base', 'service_catalog'],
        premium: [
          'tickets', 'problems', 'changes', 'assets',
          'knowledge_base', 'service_catalog', 'software_licenses', 'reports',
        ],
        enterprise: [
          'tickets', 'problems', 'changes', 'assets',
          'knowledge_base', 'service_catalog', 'software_licenses',
          'sla_policies', 'ola_policies', 'reports',
        ],
      };

      if (payload.tier === 'custom' && payload.modules) {
        return payload.modules;
      }

      return TIER_MODULES[payload.tier] || TIER_MODULES.basic;
    } catch {
      return ['tickets', 'service_catalog'];
    }
  }

  /**
   * Check if user has access to specific modules
   */
  private hasAccess(enabledModules: string[], requiredModules: string[]): boolean {
    if (!requiredModules || requiredModules.length === 0) {
      return true; // No module required
    }
    return requiredModules.every(mod => enabledModules.includes(mod));
  }

  /**
   * Check if user has access to a specific tool
   */
  async canAccessTool(toolName: string, organizationId: string): Promise<boolean> {
    const tool = this.registry.getToolDefinition(toolName);
    if (!tool) return false;

    const enabledModules = await this.getEnabledModules(organizationId);
    return this.hasAccess(enabledModules, tool.requiredModules || []);
  }

  /**
   * Get all available tools for an organization (filtered by license)
   */
  async getAvailableTools(organizationId: string): Promise<ToolDefinition[]> {
    const enabledModules = await this.getEnabledModules(organizationId);
    const allTools = this.registry.getAllTools();

    return allTools.filter(tool =>
      this.hasAccess(enabledModules, tool.requiredModules || [])
    );
  }

  /**
   * Get all tool definitions (unfiltered)
   */
  getAllToolDefinitions(): ToolDefinition[] {
    return this.registry.getAllTools();
  }

  /**
   * Get tool definition by name
   */
  getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.registry.getToolDefinition(toolName);
  }

  /**
   * Get tools organized by category
   */
  async getToolsByCategory(organizationId: string): Promise<Record<string, ToolDefinition[]>> {
    const availableTools = await this.getAvailableTools(organizationId);
    const byCategory: Record<string, ToolDefinition[]> = {};

    for (const tool of availableTools) {
      if (!byCategory[tool.category]) {
        byCategory[tool.category] = [];
      }
      byCategory[tool.category].push(tool);
    }

    return byCategory;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    userId: string,
    organizationId: string,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Build context
    const context: ToolContext = {
      userId,
      organizationId,
    };

    // Get user's organization membership for additional context
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: {
        userId,
        organizationId,
      },
      select: {
        orgRole: true,
        user: {
          select: { email: true, role: true },
        },
      },
    });

    if (orgUser) {
      context.userEmail = orgUser.user.email;
      context.userRole = orgUser.user.role;
      context.orgRole = orgUser.orgRole;
    }

    // Check access
    const enabledModules = await this.getEnabledModules(organizationId);
    const toolDef = this.registry.getToolDefinition(toolName);

    if (!toolDef) {
      return {
        success: false,
        toolName,
        error: `Tool not found: ${toolName}`,
        duration: Date.now() - startTime,
      };
    }

    if (!this.hasAccess(enabledModules, toolDef.requiredModules || [])) {
      return {
        success: false,
        toolName,
        error: 'You do not have access to this feature. Please upgrade your subscription.',
        duration: Date.now() - startTime,
      };
    }

    // Execute tool
    try {
      this.logger.log(`[ToolExecutor] Executing ${toolName} with params: ${JSON.stringify(params)}`);

      const result = await this.registry.execute(
        toolName,
        params,
        context,
        (modules) => this.hasAccess(enabledModules, modules),
      );

      const duration = Date.now() - startTime;
      this.logger.log(`[ToolExecutor] ${toolName} result: success=${result.success}, error=${result.error}`);

      // Note: Tool execution auditing is now handled by the API interceptor
      // when chatbot tools call API endpoints. No need for duplicate logging here.

      return {
        ...result,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Tool execution error for ${toolName}: ${error?.message || error}`);

      // Log tool failure for monitoring (API won't log these since the call never reached the API)
      this.auditService.logToolFailed(
        organizationId,
        organizationId,
        userId,
        toolName,
        params,
        error?.message || String(error),
        duration,
      ).catch((err) => this.logger.error('Failed to log tool failure audit', { err }));

      return {
        success: false,
        toolName,
        error: `Error executing tool: ${error?.message || error}`,
        duration,
      };
    }
  }

  /**
   * Execute multiple tools in sequence (for tool chaining)
   */
  async executeToolChain(
    tools: Array<{ name: string; params: Record<string, any> }>,
    userId: string,
    organizationId: string,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const tool of tools) {
      const result = await this.executeTool(tool.name, tool.params, userId, organizationId);
      results.push(result);

      // Stop if a tool fails (unless it's non-critical)
      if (!result.success && result.error?.includes('do not have access')) {
        break;
      }
    }

    return results;
  }

  /**
   * Get help for available tools
   */
  async getToolsHelp(organizationId: string): Promise<string> {
    const toolsByCategory = await this.getToolsByCategory(organizationId);
    const enabledModules = await this.getEnabledModules(organizationId);

    let help = 'Available AI Assistant Tools:\n\n';

    for (const [category, tools] of Object.entries(toolsByCategory)) {
      help += `${category}:\n`;
      for (const tool of tools) {
        const required = tool.requiredModules?.length
          ? ` (requires: ${tool.requiredModules.join(', ')})`
          : '';
        help += `  - ${tool.name}: ${tool.description}${required}\n`;

        const params = Object.entries(tool.parameters)
          .map(([name, param]) => {
            const req = param.required ? '*' : '';
            return `    ${name}${req}: ${param.description}`;
          })
          .join('\n');

        if (params) {
          help += `${params}\n`;
        }
      }
      help += '\n';
    }

    return help;
  }
}