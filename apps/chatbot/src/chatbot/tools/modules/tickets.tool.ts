import { Injectable, Logger } from '@nestjs/common';
import { BaseToolPlugin, ToolDefinition, ToolContext, ToolResult } from '../base-tool.interface';
import { ApiClientService, RequestContext } from '../../http/api-client.service';

/**
 * Tickets Module Tool Plugin
 * Provides CRUD operations for support tickets by calling the API
 */
@Injectable()
export class TicketsToolPlugin extends BaseToolPlugin {
  private logger = new Logger(TicketsToolPlugin.name);

  constructor(private apiClient: ApiClientService) {
    super();
  }

  readonly moduleName = 'tickets';
  readonly displayName = 'Ticket Management';
  readonly description = 'Create, view, update and search support tickets';

  getTools(): ToolDefinition[] {
    return [
      // CREATE operations
      {
        name: 'create_ticket',
        description: 'Create a new support ticket',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          title: { type: 'string', description: 'Brief title for the ticket', required: true },
          description: { type: 'string', description: 'Detailed description of the issue', required: true },
          priority: {
            type: 'string',
            description: 'Priority level',
            required: false,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
          },
          type: {
            type: 'string',
            description: 'Ticket type',
            required: false,
            enum: ['incident', 'service_request', 'problem', 'question'],
            default: 'incident',
          },
        },
      },

      // READ operations
      {
        name: 'get_ticket',
        description: 'Get detailed information about a specific ticket. The ticketId can be either the ticket UUID or the human-readable ticket number (e.g., TKT-123456).',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID or ticket number (e.g., TKT-123456)', required: true },
        },
      },
      {
        name: 'search_tickets',
        description: 'Search and filter tickets. Returns tickets sorted by creation date (newest first). If no filters are provided, returns all recent tickets.',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          query: { type: 'string', description: 'Search text to find in ticket title, description, or ticket number', required: false },
          status: {
            type: 'string',
            description: 'Filter by ticket status. Can be a single status (e.g., "new") or comma-separated statuses (e.g., "new,open,pending")',
            required: false,
          },
          priority: {
            type: 'string',
            description: 'Filter by priority level',
            required: false,
          },
          createdAfter: { type: 'string', description: 'Filter tickets created after date (ISO format)', required: false },
          createdBefore: { type: 'string', description: 'Filter tickets created before date (ISO format)', required: false },
          limit: { type: 'number', description: 'Maximum number of results (default 10, max 50)', required: false, default: 10 },
          offset: { type: 'number', description: 'Number of results to skip', required: false, default: 0 },
        },
      },
      {
        name: 'get_my_tickets',
        description: 'Get tickets created by the current user',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          status: { type: 'string', description: 'Filter by status', required: false },
          limit: { type: 'number', description: 'Maximum results (default 10)', required: false, default: 10 },
        },
      },
      {
        name: 'get_my_open_tickets',
        description: 'Get count and list of open tickets for the current user',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {},
      },
      {
        name: 'get_ticket_comments',
        description: 'Get all comments on a ticket',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID', required: true },
        },
      },
      {
        name: 'count_tickets_by_status',
        description: 'Get count of tickets grouped by status',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          assignedTo: { type: 'string', description: 'Filter by assignee', required: false },
        },
      },

      // UPDATE operations
      {
        name: 'update_ticket',
        description: 'Update ticket fields (only for ticket owner or assigned agent). The ticketId can be either the ticket UUID or the human-readable ticket number (e.g., TKT-123456).',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID or ticket number (e.g., TKT-123456). REQUIRED - must be provided.', required: true },
          title: { type: 'string', description: 'New title for the ticket' },
          description: { type: 'string', description: 'New description' },
          priority: {
            type: 'string',
            description: 'New priority level',
            required: false,
            enum: ['low', 'medium', 'high', 'critical'],
          },
          status: {
            type: 'string',
            description: 'New status',
            required: false,
            enum: ['new', 'open', 'pending', 'resolved', 'closed'],
          },
        },
      },
      {
        name: 'add_ticket_comment',
        description: 'Add a comment to a ticket. The ticketId can be either the ticket UUID or the human-readable ticket number (e.g., TKT-123456).',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID or ticket number (e.g., TKT-123456)', required: true },
          content: { type: 'string', description: 'Comment content', required: true },
          isInternal: { type: 'boolean', description: 'Mark as internal note (only visible to agents)', required: false, default: false },
        },
      },
      {
        name: 'close_ticket',
        description: 'Close a ticket with optional resolution note. The ticketId can be either the ticket UUID or the human-readable ticket number (e.g., TKT-123456).',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID or ticket number (e.g., TKT-123456)', required: true },
          resolution: { type: 'string', description: 'Resolution note', required: false },
        },
      },

      // Special operations
      {
        name: 'get_ticket_statistics',
        description: 'Get ticket statistics for the organization',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          period: {
            type: 'string',
            description: 'Time period for statistics',
            required: false,
            enum: ['today', 'week', 'month', 'quarter', 'year'],
            default: 'month',
          },
        },
      },
      {
        name: 'get_available_priorities',
        description: 'Get list of available ticket priorities',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {},
      },
      {
        name: 'get_available_statuses',
        description: 'Get list of available ticket statuses',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {},
      },
      // File Attachment operations
      {
        name: 'attach_file_to_ticket',
        description: 'Attach an uploaded file to a ticket. The fileId should be from the uploaded attachment in the conversation.',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID or ticket number (e.g., TKT-123456)', required: true },
          fileId: { type: 'string', description: 'File/Attachment ID to attach', required: true },
          description: { type: 'string', description: 'Optional description for the attachment', required: false },
        },
      },
      {
        name: 'get_ticket_attachments',
        description: 'Get all attachments for a specific ticket',
        category: 'Tickets',
        module: this.moduleName,
        requiredModules: ['tickets'],
        parameters: {
          ticketId: { type: 'string', description: 'Ticket ID or ticket number (e.g., TKT-123456)', required: true },
        },
      },
    ];
  }

  async execute(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        // CREATE
        case 'create_ticket':
          return this.createTicket(params, context);

        // READ
        case 'get_ticket':
          return this.getTicket(params, context);
        case 'search_tickets':
          return this.searchTickets(params, context);
        case 'get_my_tickets':
          return this.getMyTickets(params, context);
        case 'get_my_open_tickets':
          return this.getMyOpenTickets(context);
        case 'get_ticket_comments':
          return this.getTicketComments(params, context);
        case 'count_tickets_by_status':
          return this.countTicketsByStatus(params, context);

        // UPDATE
        case 'update_ticket':
          return this.updateTicket(params, context);
        case 'add_ticket_comment':
          return this.addTicketComment(params, context);
        case 'close_ticket':
          return this.closeTicket(params, context);

        // Special
        case 'get_ticket_statistics':
          return this.getTicketStatistics(params, context);
        case 'get_available_priorities':
          return this.getAvailablePriorities();
        case 'get_available_statuses':
          return this.getAvailableStatuses();

        // File Attachment operations
        case 'attach_file_to_ticket':
          return this.attachFileToTicket(params, context);
        case 'get_ticket_attachments':
          return this.getTicketAttachments(params, context);

        default:
          return { success: false, toolName, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      this.logger.error(`Error executing ${toolName}: ${error?.message || error}`);
      return { success: false, toolName, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Build request context for API calls
   */
  private buildRequestContext(context: ToolContext): RequestContext {
    return {
      userId: context.userId,
      organizationId: context.organizationId,
      userEmail: context.userEmail,
      // Access token would need to be passed differently - for now we'll rely on x-organization-id
      accessToken: undefined,
    };
  }

  // ====================
  // CREATE Operations
  // ====================

  private async createTicket(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.post('/v1/tickets', reqContext, {
      title: params.title,
      description: params.description,
      priority: params.priority || 'medium',
      type: params.type || 'incident',
    });

    if (!response.success) {
      return { success: false, toolName: 'create_ticket', error: response.error };
    }

    const ticket = response.data;
    return {
      success: true,
      toolName: 'create_ticket',
      result: {
        message: `Ticket ${ticket.ticketNumber || ticket.id} created successfully`,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
      },
      references: [{
        type: 'ticket',
        id: ticket.id,
        title: ticket.title,
        url: `/tickets/${ticket.id}`,
      }],
    };
  }

  // ====================
  // READ Operations
  // ====================

  private async getTicket(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Try by ID first, then by ticket number
    let response = await this.apiClient.get(`/v1/tickets/${params.ticketId}`, reqContext);

    if (!response.success && response.statusCode === 404) {
      // Try by ticket number endpoint
      response = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
    }

    if (!response.success) {
      return { success: false, toolName: 'get_ticket', error: response.error };
    }

    const ticket = response.data;
    return {
      success: true,
      toolName: 'get_ticket',
      result: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        type: ticket.type,
        status: ticket.status,
        priority: ticket.priority,
        requester: ticket.requester,
        assignedTo: ticket.assignedTo || ticket.assignedAgent,
        category: ticket.category,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
      },
      references: [{
        type: 'ticket',
        id: ticket.id,
        title: ticket.title,
        url: `/tickets/${ticket.id}`,
      }],
    };
  }

  private async searchTickets(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Build query params
    const queryParams: Record<string, any> = {
      limit: Math.min(params.limit || 10, 50),
    };

    if (params.offset) queryParams.offset = params.offset;
    if (params.query && params.query !== 'true' && params.query !== 'false') {
      queryParams.search = params.query;
    }
    if (params.status) {
      // Handle comma-separated status
      if (params.status.includes(',')) {
        queryParams.status = params.status.split(',').map((s: string) => s.trim());
      } else {
        queryParams.status = params.status;
      }
    }
    if (params.priority) queryParams.priority = params.priority;
    if (params.createdAfter) queryParams.createdAfter = params.createdAfter;
    if (params.createdBefore) queryParams.createdBefore = params.createdBefore;

    const response = await this.apiClient.get('/v1/tickets', reqContext, queryParams);

    if (!response.success) {
      return { success: false, toolName: 'search_tickets', error: response.error };
    }

    // Handle both array response and paginated response
    const tickets = Array.isArray(response.data) ? response.data : (response.data.items || response.data.tickets || []);

    return {
      success: true,
      toolName: 'search_tickets',
      result: {
        tickets: tickets.map((t: any) => ({
          ticketId: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          type: t.type,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          requesterName: t.requesterName || (t.requester ? `${t.requester.firstName} ${t.requester.lastName}` : 'Unknown'),
        })),
        total: response.data.total || tickets.length,
        limit: queryParams.limit,
        offset: params.offset || 0,
      },
      references: tickets.map((t: any) => ({
        type: 'ticket' as const,
        id: t.id,
        title: `${t.ticketNumber}: ${t.title}`,
        url: `/tickets/${t.id}`,
      })),
    };
  }

  private async getMyTickets(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const queryParams: Record<string, any> = {
      requesterId: context.userId,
      limit: params.limit || 10,
    };

    if (params.status) queryParams.status = params.status;

    const response = await this.apiClient.get('/v1/tickets', reqContext, queryParams);

    if (!response.success) {
      return { success: false, toolName: 'get_my_tickets', error: response.error };
    }

    const tickets = Array.isArray(response.data) ? response.data : (response.data.items || response.data.tickets || []);

    return {
      success: true,
      toolName: 'get_my_tickets',
      result: {
        tickets: tickets.map((t: any) => ({
          ticketId: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
        })),
        total: tickets.length,
      },
      references: tickets.map((t: any) => ({
        type: 'ticket' as const,
        id: t.id,
        title: `${t.ticketNumber}: ${t.title}`,
        url: `/tickets/${t.id}`,
      })),
    };
  }

  private async getMyOpenTickets(context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // "open" means tickets that are not resolved or closed
    // Valid statuses in the API: new, assigned, in_progress, pending, resolved, closed
    const response = await this.apiClient.get('/v1/tickets', reqContext, {
      requesterId: context.userId,
      status: ['new', 'assigned', 'in_progress', 'pending'],
      limit: 50,
    });

    if (!response.success) {
      return { success: false, toolName: 'get_my_open_tickets', error: response.error };
    }

    const tickets = Array.isArray(response.data) ? response.data : (response.data.items || response.data.tickets || []);

    return {
      success: true,
      toolName: 'get_my_open_tickets',
      result: {
        count: tickets.length,
        tickets: tickets.map((t: any) => ({
          ticketId: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
        })),
      },
      references: tickets.map((t: any) => ({
        type: 'ticket' as const,
        id: t.id,
        title: `${t.ticketNumber}: ${t.title}`,
        url: `/tickets/${t.id}`,
      })),
    };
  }

  private async getTicketComments(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First get the ticket to get its ID
    let ticketId = params.ticketId;

    // Check if it's a ticket number (not a UUID)
    const isTicketNumber = params.ticketId.includes('-') && !this.isUUID(params.ticketId);
    if (isTicketNumber) {
      const ticketResponse = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
      if (!ticketResponse.success) {
        return { success: false, toolName: 'get_ticket_comments', error: 'Ticket not found' };
      }
      ticketId = ticketResponse.data.id;
    }

    const response = await this.apiClient.get(`/v1/tickets/${ticketId}/comments`, reqContext);

    if (!response.success) {
      return { success: false, toolName: 'get_ticket_comments', error: response.error };
    }

    const comments = Array.isArray(response.data) ? response.data : (response.data.items || response.data.comments || []);

    return {
      success: true,
      toolName: 'get_ticket_comments',
      result: {
        ticketId,
        comments: comments.map((c: any) => ({
          id: c.id,
          content: c.content,
          authorName: c.authorName || (c.author ? `${c.author.firstName} ${c.author.lastName}` : 'Unknown'),
          isInternal: c.isInternal,
          createdAt: c.createdAt,
        })),
      },
    };
  }

  private async countTicketsByStatus(params: any, context: ToolContext): Promise<ToolResult> {
    // For count by status, we'll search and aggregate
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/tickets', reqContext, {
      limit: 1, // We just need the counts
      countOnly: true, // API might support this
    });

    if (!response.success) {
      // Fall back to counting manually
      const searchResponse = await this.apiClient.get('/v1/tickets', reqContext, { limit: 1 });
      if (!searchResponse.success) {
        return { success: false, toolName: 'count_tickets_by_status', error: response.error };
      }
      // API doesn't support count endpoint, return placeholder
      return {
        success: true,
        toolName: 'count_tickets_by_status',
        result: {
          message: 'Use search_tickets to get ticket counts by status',
          statusCounts: {},
          total: 0,
        },
      };
    }

    // If API returns counts, use it
    if (response.data.statusCounts) {
      const statusCounts = response.data.statusCounts as Record<string, number>;
      return {
        success: true,
        toolName: 'count_tickets_by_status',
        result: {
          statusCounts,
          total: response.data.total || Object.values(statusCounts).reduce((a, b) => a + b, 0),
        },
      };
    }

    return {
      success: true,
      toolName: 'count_tickets_by_status',
      result: {
        statusCounts: {},
        total: response.data.total || 0,
      },
    };
  }

  /**
   * Check if a string is a valid UUID
   */
  private isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  // ====================
  // UPDATE Operations
  // ====================

  private async updateTicket(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First get the ticket to determine its ID
    let ticketId = params.ticketId;

    // Check if it's a ticket number (not a UUID)
    // UUIDs are like: 550e8400-e29b-41d4-a716-446655440000 (36 chars with 4 hyphens)
    // Ticket numbers are like: TKT-123, INC-00001, INC-00001-ABCD, SR-00001-ABCD
    const isTicketNumber = params.ticketId.includes('-') && !this.isUUID(params.ticketId);
    if (isTicketNumber) {
      const ticketResponse = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
      if (!ticketResponse.success) {
        return { success: false, toolName: 'update_ticket', error: 'Ticket not found' };
      }
      ticketId = ticketResponse.data.id;
    }

    // Build update body
    const updateData: any = {};
    if (params.title) updateData.title = params.title;
    if (params.description) updateData.description = params.description;
    if (params.priority) updateData.priority = params.priority;
    if (params.status) updateData.status = params.status;

    const response = await this.apiClient.patch(`/v1/tickets/${ticketId}`, reqContext, updateData);

    if (!response.success) {
      return { success: false, toolName: 'update_ticket', error: response.error };
    }

    const ticket = response.data;
    return {
      success: true,
      toolName: 'update_ticket',
      result: {
        message: `Ticket ${ticket.ticketNumber || ticketId} updated successfully`,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
      },
      references: [{
        type: 'ticket',
        id: ticket.id,
        title: ticket.title,
        url: `/tickets/${ticket.id}`,
      }],
    };
  }

  private async addTicketComment(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First get the ticket to determine its ID
    let ticketId = params.ticketId;

    const isTicketNumber = params.ticketId.includes('-') && !this.isUUID(params.ticketId);
    if (isTicketNumber) {
      const ticketResponse = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
      if (!ticketResponse.success) {
        return { success: false, toolName: 'add_ticket_comment', error: 'Ticket not found' };
      }
      ticketId = ticketResponse.data.id;
    }

    const response = await this.apiClient.post(`/v1/tickets/${ticketId}/comments`, reqContext, {
      content: params.content,
      isInternal: params.isInternal || false,
    });

    if (!response.success) {
      return { success: false, toolName: 'add_ticket_comment', error: response.error };
    }

    const comment = response.data;
    return {
      success: true,
      toolName: 'add_ticket_comment',
      result: {
        message: 'Comment added successfully',
        commentId: comment.id,
        ticketId,
        createdAt: comment.createdAt,
      },
      references: [{
        type: 'ticket',
        id: ticketId,
        url: `/tickets/${ticketId}`,
      }],
    };
  }

  private async closeTicket(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First get the ticket to determine its ID
    let ticketId = params.ticketId;

    const isTicketNumber = params.ticketId.includes('-') && !this.isUUID(params.ticketId);
    if (isTicketNumber) {
      const ticketResponse = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
      if (!ticketResponse.success) {
        return { success: false, toolName: 'close_ticket', error: 'Ticket not found' };
      }
      ticketId = ticketResponse.data.id;
    }

    // Use transition endpoint to close the ticket
    const response = await this.apiClient.post(`/v1/tickets/${ticketId}/transition`, reqContext, {
      status: 'resolved',
      comment: params.resolution ? `Resolution: ${params.resolution}` : undefined,
    });

    if (!response.success) {
      // Fall back to direct PATCH
      const updateResponse = await this.apiClient.patch(`/v1/tickets/${ticketId}`, reqContext, {
        status: 'resolved',
      });

      if (!updateResponse.success) {
        return { success: false, toolName: 'close_ticket', error: response.error || updateResponse.error };
      }

      return {
        success: true,
        toolName: 'close_ticket',
        result: {
          message: `Ticket closed successfully`,
          ticketId,
          resolvedAt: updateResponse.data.resolvedAt || new Date(),
        },
      };
    }

    return {
      success: true,
      toolName: 'close_ticket',
      result: {
        message: `Ticket ${params.ticketId} closed successfully`,
        ticketId,
        resolvedAt: response.data.resolvedAt || new Date(),
      },
    };
  }

  // ====================
  // Statistics
  // ====================

  private async getTicketStatistics(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // API may have a statistics endpoint, try it
    const response = await this.apiClient.get('/v1/tickets/statistics', reqContext, {
      period: params.period || 'month',
    });

    if (!response.success) {
      // Fall back to getting all tickets and counting
      const ticketsResponse = await this.apiClient.get('/v1/tickets', reqContext, {
        limit: 1000,
      });

      if (!ticketsResponse.success) {
        return { success: false, toolName: 'get_ticket_statistics', error: response.error };
      }

      // Calculate stats from response
      const tickets = Array.isArray(ticketsResponse.data)
        ? ticketsResponse.data
        : (ticketsResponse.data.items || ticketsResponse.data.tickets || []);

      const statusCounts: Record<string, number> = {
        new: 0, open: 0, pending: 0, resolved: 0, closed: 0,
      };
      const priorityCounts: Record<string, number> = {
        low: 0, medium: 0, high: 0, critical: 0,
      };

      for (const ticket of tickets) {
        if (statusCounts[ticket.status] !== undefined) {
          statusCounts[ticket.status]++;
        }
        if (priorityCounts[ticket.priority] !== undefined) {
          priorityCounts[ticket.priority]++;
        }
      }

      return {
        success: true,
        toolName: 'get_ticket_statistics',
        result: {
          period: params.period || 'month',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
          totalTickets: tickets.length,
          byStatus: statusCounts,
          byPriority: priorityCounts,
        },
      };
    }

    return {
      success: true,
      toolName: 'get_ticket_statistics',
      result: {
        period: params.period || 'month',
        ...response.data,
      },
    };
  }

  private getAvailablePriorities(): ToolResult {
    return {
      success: true,
      toolName: 'get_available_priorities',
      result: {
        priorities: [
          { value: 'low', label: 'Low', description: 'Minor issue, no urgency' },
          { value: 'medium', label: 'Medium', description: 'Standard priority' },
          { value: 'high', label: 'High', description: 'Significant impact' },
          { value: 'critical', label: 'Critical', description: 'System down or major outage' },
        ],
      },
    };
  }

  private getAvailableStatuses(): ToolResult {
    return {
      success: true,
      toolName: 'get_available_statuses',
      result: {
        statuses: [
          { value: 'new', label: 'New', description: 'Newly created ticket' },
          { value: 'open', label: 'Open', description: 'Ticket is being worked on' },
          { value: 'pending', label: 'Pending', description: 'Awaiting response or action' },
          { value: 'resolved', label: 'Resolved', description: 'Issue resolved' },
          { value: 'closed', label: 'Closed', description: 'Ticket closed' },
        ],
      },
    };
  }

  // ====================
  // File Attachment Operations
  // ====================

  private async attachFileToTicket(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First get the ticket to determine its ID
    let ticketId = params.ticketId;

    const isTicketNumber = params.ticketId.includes('-') && !this.isUUID(params.ticketId);
    if (isTicketNumber) {
      const ticketResponse = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
      if (!ticketResponse.success) {
        return { success: false, toolName: 'attach_file_to_ticket', error: 'Ticket not found' };
      }
      ticketId = ticketResponse.data.id;
    }

    // Link the attachment to the ticket via internal API
    const response = await this.apiClient.post(`/v1/storage/link-to-ticket`, reqContext, {
      ticketId,
      attachmentId: params.fileId,
      description: params.description,
    });

    if (!response.success) {
      return { success: false, toolName: 'attach_file_to_ticket', error: response.error };
    }

    return {
      success: true,
      toolName: 'attach_file_to_ticket',
      result: {
        message: 'File attached successfully',
        ticketId,
        attachmentId: params.fileId,
      },
      references: [{
        type: 'ticket',
        id: ticketId,
        url: `/tickets/${ticketId}`,
      }],
    };
  }

  private async getTicketAttachments(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // First get the ticket to determine its ID
    let ticketId = params.ticketId;

    const isTicketNumber = params.ticketId.includes('-') && !this.isUUID(params.ticketId);
    if (isTicketNumber) {
      const ticketResponse = await this.apiClient.get(`/v1/tickets/number/${params.ticketId}`, reqContext);
      if (!ticketResponse.success) {
        return { success: false, toolName: 'get_ticket_attachments', error: 'Ticket not found' };
      }
      ticketId = ticketResponse.data.id;
    }

    const response = await this.apiClient.get(`/v1/storage/ticket/${ticketId}`, reqContext);

    if (!response.success) {
      return { success: false, toolName: 'get_ticket_attachments', error: response.error };
    }

    const attachments = Array.isArray(response.data) ? response.data : (response.data.items || []);

    return {
      success: true,
      toolName: 'get_ticket_attachments',
      result: {
        ticketId,
        attachments: attachments.map((a: any) => ({
          id: a.id,
          name: a.originalName || a.filename,
          size: a.fileSize,
          type: a.mimeType,
          uploadedBy: a.uploadedBy ? `${a.uploadedBy.firstName} ${a.uploadedBy.lastName}` : 'Unknown',
          uploadedAt: a.createdAt,
          url: a.url,
        })),
      },
    };
  }
}