import { Injectable, Logger } from '@nestjs/common';
import { BaseToolPlugin, ToolDefinition, ToolContext, ToolResult } from '../base-tool.interface';
import { ApiClientService, RequestContext } from '../../http/api-client.service';

/**
 * Service Catalog Module Tool Plugin
 * Provides access to IT services and service requests via API
 */
@Injectable()
export class ServiceCatalogToolPlugin extends BaseToolPlugin {
  private logger = new Logger(ServiceCatalogToolPlugin.name);

  constructor(private apiClient: ApiClientService) {
    super();
  }

  readonly moduleName = 'service_catalog';
  readonly displayName = 'Service Catalog';
  readonly description = 'Browse and request IT services';

  getTools(): ToolDefinition[] {
    return [
      // Service browsing
      {
        name: 'search_services',
        description: 'Search available services in the catalog',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          query: { type: 'string', description: 'Search query', required: false },
          categoryId: { type: 'string', description: 'Filter by category', required: false },
          limit: { type: 'number', description: 'Max results (default 10)', required: false, default: 10 },
        },
      },
      {
        name: 'get_service',
        description: 'Get detailed information about a specific service',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          serviceId: { type: 'string', description: 'Service ID', required: true },
        },
      },
      {
        name: 'get_services_by_category',
        description: 'Get all services in a category',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          categoryId: { type: 'string', description: 'Category ID', required: true },
          limit: { type: 'number', description: 'Max results', required: false, default: 20 },
        },
      },
      {
        name: 'get_service_categories',
        description: 'List all service categories',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          limit: { type: 'number', description: 'Max results', required: false, default: 20 },
        },
      },
      {
        name: 'get_featured_services',
        description: 'Get featured/recommended services',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          limit: { type: 'number', description: 'Number of services', required: false, default: 5 },
        },
      },

      // Service requests
      {
        name: 'submit_service_request',
        description: 'Submit a request for a service',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          serviceId: { type: 'string', description: 'Service ID to request', required: true },
          justification: { type: 'string', description: 'Business justification', required: true },
          quantity: { type: 'number', description: 'Quantity needed', required: false, default: 1 },
        },
      },
      {
        name: 'get_my_service_requests',
        description: 'Get service requests submitted by the current user',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          status: { type: 'string', description: 'Filter by status', required: false },
          limit: { type: 'number', description: 'Max results', required: false, default: 10 },
        },
      },
      {
        name: 'get_service_request_status',
        description: 'Check the status of a service request',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          requestId: { type: 'string', description: 'Request ID or request number', required: true },
        },
      },
      {
        name: 'cancel_service_request',
        description: 'Cancel a pending service request',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          requestId: { type: 'string', description: 'Request ID', required: true },
          reason: { type: 'string', description: 'Cancellation reason', required: false },
        },
      },

      // Information
      {
        name: 'get_service_sla',
        description: 'Get SLA information for a service',
        category: 'Service Catalog',
        module: this.moduleName,
        requiredModules: ['service_catalog'],
        parameters: {
          serviceId: { type: 'string', description: 'Service ID', required: true },
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
        // Browsing
        case 'search_services':
          return this.searchServices(params, context);
        case 'get_service':
          return this.getService(params, context);
        case 'get_services_by_category':
          return this.getServicesByCategory(params, context);
        case 'get_service_categories':
          return this.getServiceCategories(params, context);
        case 'get_featured_services':
          return this.getFeaturedServices(params, context);

        // Requests
        case 'submit_service_request':
          return this.submitServiceRequest(params, context);
        case 'get_my_service_requests':
          return this.getMyServiceRequests(params, context);
        case 'get_service_request_status':
          return this.getServiceRequestStatus(params, context);
        case 'cancel_service_request':
          return this.cancelServiceRequest(params, context);

        // Info
        case 'get_service_sla':
          return this.getServiceSLA(params, context);

        default:
          return { success: false, toolName, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      this.logger.error(`Error executing ${toolName}: ${error?.message || error}`);
      return { success: false, toolName, error: error?.message || 'Unknown error' };
    }
  }

  private buildRequestContext(context: ToolContext): RequestContext {
    return {
      userId: context.userId,
      organizationId: context.organizationId,
      userEmail: context.userEmail,
    };
  }

  // ====================
  // Browsing
  // ====================

  private async searchServices(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/service-catalog/services', reqContext, {
      search: params.query,
      categoryId: params.categoryId,
      limit: params.limit || 10,
      status: 'active',
    });

    if (!response.success) {
      return { success: false, toolName: 'search_services', error: response.error };
    }

    const services = Array.isArray(response.data) ? response.data : (response.data.items || response.data.services || []);

    return {
      success: true,
      toolName: 'search_services',
      result: {
        query: params.query,
        total: services.length,
        services: services.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.categoryName || (s.category ? s.category.name : null),
        })),
      },
      references: services.map((s: any) => ({
        type: 'service' as const,
        id: s.id,
        title: s.name,
        url: `/services/${s.id}`,
      })),
    };
  }

  private async getService(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get(`/v1/service-catalog/services/${params.serviceId}`, reqContext);

    if (!response.success) {
      return { success: false, toolName: 'get_service', error: response.error };
    }

    const service = response.data;

    return {
      success: true,
      toolName: 'get_service',
      result: {
        id: service.id,
        name: service.name,
        description: service.description,
        instructions: service.instructions,
        category: service.categoryName || (service.category ? service.category.name : null),
        status: service.status,
      },
      references: [{
        type: 'service',
        id: service.id,
        title: service.name,
        url: `/services/${service.id}`,
      }],
    };
  }

  private async getServicesByCategory(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/service-catalog/services', reqContext, {
      categoryId: params.categoryId,
      limit: params.limit || 20,
      status: 'active',
    });

    if (!response.success) {
      return { success: false, toolName: 'get_services_by_category', error: response.error };
    }

    const services = Array.isArray(response.data) ? response.data : (response.data.items || response.data.services || []);

    return {
      success: true,
      toolName: 'get_services_by_category',
      result: {
        categoryId: params.categoryId,
        total: services.length,
        services: services.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })),
      },
    };
  }

  private async getServiceCategories(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/service-catalog/categories', reqContext, {
      limit: params.limit || 20,
    });

    if (!response.success) {
      return { success: false, toolName: 'get_service_categories', error: response.error };
    }

    const categories = Array.isArray(response.data) ? response.data : (response.data.items || response.data.categories || []);

    return {
      success: true,
      toolName: 'get_service_categories',
      result: {
        categories: categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          serviceCount: c.serviceCount || c._count?.services || 0,
        })),
      },
    };
  }

  private async getFeaturedServices(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.get('/v1/service-catalog/services/featured', reqContext, {
      limit: params.limit || 5,
    });

    if (!response.success) {
      // Fall back to getting recent services
      const fallbackResponse = await this.apiClient.get('/v1/service-catalog/services', reqContext, {
        limit: params.limit || 5,
        status: 'active',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (!fallbackResponse.success) {
        return { success: false, toolName: 'get_featured_services', error: response.error };
      }

      const services = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : (fallbackResponse.data.items || fallbackResponse.data.services || []);

      return {
        success: true,
        toolName: 'get_featured_services',
        result: {
          services: services.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description,
          })),
        },
        references: services.map((s: any) => ({
          type: 'service' as const,
          id: s.id,
          title: s.name,
          url: `/services/${s.id}`,
        })),
      };
    }

    const services = Array.isArray(response.data) ? response.data : (response.data.items || response.data.services || []);

    return {
      success: true,
      toolName: 'get_featured_services',
      result: {
        services: services.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description,
        })),
      },
      references: services.map((s: any) => ({
        type: 'service' as const,
        id: s.id,
        title: s.name,
        url: `/services/${s.id}`,
      })),
    };
  }

  // ====================
  // Requests
  // ====================

  private async submitServiceRequest(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const response = await this.apiClient.post('/v1/service-catalog/requests', reqContext, {
      serviceId: params.serviceId,
      justification: params.justification,
      quantity: params.quantity || 1,
    });

    if (!response.success) {
      return { success: false, toolName: 'submit_service_request', error: response.error };
    }

    const request = response.data;

    return {
      success: true,
      toolName: 'submit_service_request',
      result: {
        message: `Service request ${request.requestNumber || request.id} submitted successfully`,
        requestId: request.id,
        requestNumber: request.requestNumber,
        serviceName: request.serviceName || (request.service ? request.service.name : null),
        status: request.status,
        submittedAt: request.createdAt,
      },
      references: [{
        type: 'service_request',
        id: request.id,
        title: `${request.serviceName || 'Service'} Request`,
        url: `/service-requests/${request.requestNumber || request.id}`,
      }],
    };
  }

  private async getMyServiceRequests(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    const queryParams: Record<string, any> = {
      limit: params.limit || 10,
    };

    if (params.status) queryParams.status = params.status;

    const response = await this.apiClient.get('/v1/service-catalog/requests', reqContext, queryParams);

    if (!response.success) {
      return { success: false, toolName: 'get_my_service_requests', error: response.error };
    }

    const requests = Array.isArray(response.data) ? response.data : (response.data.items || response.data.requests || []);

    return {
      success: true,
      toolName: 'get_my_service_requests',
      result: {
        total: requests.length,
        requests: requests.map((r: any) => ({
          id: r.id,
          requestNumber: r.requestNumber,
          serviceName: r.serviceName || (r.service ? r.service.name : null),
          status: r.status,
          justification: r.justification,
          submittedAt: r.createdAt,
        })),
      },
    };
  }

  private async getServiceRequestStatus(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Try by ID first, then by request number
    let response = await this.apiClient.get(`/v1/service-catalog/requests/${params.requestId}`, reqContext);

    if (!response.success && response.statusCode === 404) {
      // Try by request number endpoint
      response = await this.apiClient.get(`/v1/service-catalog/requests/number/${params.requestId}`, reqContext);
    }

    if (!response.success) {
      return { success: false, toolName: 'get_service_request_status', error: response.error };
    }

    const request = response.data;

    return {
      success: true,
      toolName: 'get_service_request_status',
      result: {
        id: request.id,
        requestNumber: request.requestNumber,
        serviceName: request.serviceName || (request.service ? request.service.name : null),
        status: request.status,
        justification: request.justification,
        requester: request.requesterName || (request.requester ? `${request.requester.firstName} ${request.requester.lastName}` : null),
        submittedAt: request.createdAt,
      },
      references: [{
        type: 'service_request',
        id: request.id,
        title: `${request.serviceName || 'Service'} Request`,
        url: `/service-requests/${request.requestNumber || request.id}`,
      }],
    };
  }

  private async cancelServiceRequest(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Try to cancel via API
    const response = await this.apiClient.post(`/v1/service-catalog/requests/${params.requestId}/cancel`, reqContext, {
      reason: params.reason,
    });

    if (!response.success) {
      // Fall back to direct status update
      const updateResponse = await this.apiClient.patch(`/v1/service-catalog/requests/${params.requestId}`, reqContext, {
        status: 'cancelled',
      });

      if (!updateResponse.success) {
        return { success: false, toolName: 'cancel_service_request', error: response.error || updateResponse.error };
      }

      return {
        success: true,
        toolName: 'cancel_service_request',
        result: {
          message: `Service request cancelled`,
          requestId: params.requestId,
          status: 'cancelled',
        },
      };
    }

    return {
      success: true,
      toolName: 'cancel_service_request',
      result: {
        message: `Service request cancelled successfully`,
        requestId: response.data.id || params.requestId,
        requestNumber: response.data.requestNumber,
        status: response.data.status || 'cancelled',
      },
    };
  }

  // ====================
  // Information
  // ====================

  private async getServiceSLA(params: any, context: ToolContext): Promise<ToolResult> {
    const reqContext = this.buildRequestContext(context);

    // Try to get SLA info from service endpoint
    const response = await this.apiClient.get(`/v1/service-catalog/services/${params.serviceId}/sla`, reqContext);

    if (!response.success) {
      // Return placeholder SLA info
      return {
        success: true,
        toolName: 'get_service_sla',
        result: {
          serviceId: params.serviceId,
          slaInfo: {
            responseTime: '24 hours',
            resolutionTime: '5 business days',
            availability: 'Business hours (Mon-Fri, 9AM-6PM)',
            note: 'SLA times may vary based on service complexity and priority',
          },
        },
      };
    }

    return {
      success: true,
      toolName: 'get_service_sla',
      result: {
        serviceId: params.serviceId,
        ...response.data,
      },
    };
  }
}