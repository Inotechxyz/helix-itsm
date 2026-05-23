/**
 * API Client Service
 *
 * Handles HTTP calls to the main API app with proper authentication.
 * This ensures chatbot tools respect API authentication, authorization,
 * and business logic instead of bypassing them with direct database access.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * API Client Service constructor options
 */
export interface ApiClientOptions {
  baseUrl?: string;
  timeout?: number;
}

/**
 * Request context with auth headers
 */
export interface RequestContext {
  userId: string;
  organizationId: string;
  userEmail?: string;
  accessToken?: string;
}

@Injectable()
export class ApiClientService {
  private readonly logger = new Logger(ApiClientService.name);
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly internalApiKey: string | undefined;

  constructor(
    private config: ConfigService,
    private httpService: HttpService,
  ) {
    // Default to localhost:3000 for API, configurable via environment
    this.baseUrl = this.config.get('API_BASE_URL') || 'http://localhost:3000';
    this.timeout = 30000; // 30 second timeout
    // Use INTERNAL_API_KEY for service-to-service auth
    this.internalApiKey = this.config.get('INTERNAL_API_KEY');
    this.logger.log(`ApiClientService initialized with baseUrl: ${this.baseUrl}`);
    if (this.internalApiKey) {
      this.logger.log('Internal API key configured for service-to-service calls');
    }
  }

  /**
   * Build auth headers for API requests
   */
  private buildHeaders(context: RequestContext): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-organization-id': context.organizationId,
      'x-chatbot-service': 'true', // Mark as chatbot service call
    };

    // Use internal API key if available (service-to-service auth)
    if (this.internalApiKey) {
      headers['x-internal-api-key'] = this.internalApiKey;
      headers['x-user-id'] = context.userId;
      headers['x-user-email'] = context.userEmail || '';
    } else if (context.accessToken) {
      // Fall back to user access token if no internal key
      headers['Authorization'] = `Bearer ${context.accessToken}`;
    }

    return headers;
  }

  /**
   * Make a GET request
   */
  async get<T = any>(
    path: string,
    context: RequestContext,
    params?: Record<string, any>,
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${path}`;
      const headers = this.buildHeaders(context);

      this.logger.debug(`[ApiClient] GET ${url} with params: ${JSON.stringify(params)}`);

      // Configure axios to serialize arrays as comma-separated values (NestJS expects this format)
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers,
          params,
          timeout: this.timeout,
          paramsSerializer: (params) => {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
              if (Array.isArray(value)) {
                // For arrays, use comma-separated format (e.g., status=new,open,pending)
                searchParams.append(key, value.join(','));
              } else if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
              }
            }
            return searchParams.toString();
          },
        }),
      );

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error: any) {
      return this.handleError(error, 'GET', path);
    }
  }

  /**
   * Make a POST request
   */
  async post<T = any>(
    path: string,
    context: RequestContext,
    body?: any,
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${path}`;
      const headers = this.buildHeaders(context);

      this.logger.debug(`[ApiClient] POST ${url} with body: ${JSON.stringify(body)}`);

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers, timeout: this.timeout }),
      );

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error: any) {
      return this.handleError(error, 'POST', path);
    }
  }

  /**
   * Make a PATCH request
   */
  async patch<T = any>(
    path: string,
    context: RequestContext,
    body?: any,
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${path}`;
      const headers = this.buildHeaders(context);

      this.logger.debug(`[ApiClient] PATCH ${url} with body: ${JSON.stringify(body)}`);

      const response = await firstValueFrom(
        this.httpService.patch(url, body, { headers, timeout: this.timeout }),
      );

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error: any) {
      return this.handleError(error, 'PATCH', path);
    }
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(
    path: string,
    context: RequestContext,
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${path}`;
      const headers = this.buildHeaders(context);

      this.logger.debug(`[ApiClient] DELETE ${url}`);

      const response = await firstValueFrom(
        this.httpService.delete(url, { headers, timeout: this.timeout }),
      );

      return {
        success: true,
        data: response.data,
        statusCode: response.status,
      };
    } catch (error: any) {
      return this.handleError(error, 'DELETE', path);
    }
  }

  /**
   * Handle HTTP errors and convert to ApiResponse
   */
  private handleError(error: any, method: string, path: string): ApiResponse {
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';

    this.logger.error(`[ApiClient] ${method} ${path} failed: ${errorMessage} (${statusCode})`);

    // Map common status codes to user-friendly messages
    let userMessage = errorMessage;
    if (statusCode === 401) {
      userMessage = 'Authentication failed. Please log in again.';
    } else if (statusCode === 403) {
      userMessage = 'You do not have permission to perform this action.';
    } else if (statusCode === 404) {
      userMessage = 'The requested resource was not found.';
    } else if (statusCode === 422) {
      userMessage = errorMessage; // Validation errors
    }

    return {
      success: false,
      error: userMessage,
      statusCode,
    };
  }

  /**
   * Get the base URL (for testing/debugging)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}