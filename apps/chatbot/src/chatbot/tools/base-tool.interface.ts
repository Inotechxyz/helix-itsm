/**
 * Parameter definition for tool
 */
export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

/**
 * Tool definition interface
 */
export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  module: string; // Module name (tickets, knowledge_base, etc.)
  parameters: Record<string, ToolParameter>;
  requiredModules?: string[]; // Required modules for access
}

/**
 * Tool execution context
 */
export interface ToolContext {
  userId: string;
  organizationId: string;
  userEmail?: string;
  userRole?: string;
  orgRole?: string;
}

/**
 * Base result returned by all tool executions
 */
export interface ToolResult {
  success: boolean;
  toolName: string;
  result?: any;
  error?: string;
  references?: any[];
}

/**
 * Base class for tool plugins
 */
export abstract class BaseToolPlugin {
  abstract readonly moduleName: string;
  abstract readonly displayName: string;
  abstract readonly description: string;

  /**
   * Get all tools provided by this plugin
   */
  abstract getTools(): ToolDefinition[];

  /**
   * Execute a tool by name
   */
  abstract execute(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult>;

  /**
   * Check if this plugin has access to a specific tool
   */
  hasTool(toolName: string): boolean {
    return this.getTools().some(t => t.name === toolName);
  }

  /**
   * Get required modules for this plugin
   */
  getRequiredModules(): string[] {
    const modules = new Set<string>();
    for (const tool of this.getTools()) {
      for (const mod of tool.requiredModules || []) {
        modules.add(mod);
      }
    }
    return Array.from(modules);
  }
}

/**
 * Tool registry for managing all tool plugins
 */
export class ToolRegistry {
  private plugins: Map<string, BaseToolPlugin> = new Map();
  private toolsByName: Map<string, ToolDefinition> = new Map();

  register(plugin: BaseToolPlugin): void {
    this.plugins.set(plugin.moduleName, plugin);

    for (const tool of plugin.getTools()) {
      this.toolsByName.set(tool.name, tool);
    }
  }

  getPlugin(moduleName: string): BaseToolPlugin | undefined {
    return this.plugins.get(moduleName);
  }

  getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.toolsByName.get(toolName);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.toolsByName.values());
  }

  getToolsByModule(moduleName: string): ToolDefinition[] {
    const plugin = this.plugins.get(moduleName);
    return plugin?.getTools() || [];
  }

  hasTool(toolName: string): boolean {
    return this.toolsByName.has(toolName);
  }

  async execute(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
    hasAccess: (modules: string[]) => boolean,
  ): Promise<ToolResult> {
    const tool = this.toolsByName.get(toolName);
    if (!tool) {
      return {
        success: false,
        toolName,
        error: `Tool not found: ${toolName}`,
      };
    }

    // Check module access
    if (!hasAccess(tool.requiredModules || [])) {
      return {
        success: false,
        toolName,
        error: 'You do not have access to this feature. Please upgrade your subscription.',
      };
    }

    const plugin = this.plugins.get(tool.module);
    if (!plugin) {
      return {
        success: false,
        toolName,
        error: `Plugin not found for module: ${tool.module}`,
      };
    }

    return plugin.execute(toolName, params, context);
  }
}

/**
 * Decorator for registering tool plugins
 */
export function registerToolPlugin() {
  return function <T extends new (...args: any[]) => BaseToolPlugin>(constructor: T) {
    // Registration is handled by ToolExecutorService
    return constructor;
  };
}