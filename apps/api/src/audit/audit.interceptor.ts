import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuditLogData } from './audit.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  // Paths to exclude from audit logging
  private readonly excludePaths = [
    '/health',
    '/metrics',
    '/v1/auth/login',
    '/v1/auth/refresh',
    '/v1/auth/org/login',
    '/v1/auth/org/switch',
  ];

  // Entity type mappings based on path
  private readonly pathToEntityType: Record<string, string> = {
    '/tickets': 'tickets',
    '/users': 'users',
    '/teams': 'teams',
    '/organizations': 'organizations',
    '/knowledge-base': 'knowledge_base',
    '/service-catalog': 'service_catalog',
    '/assets': 'assets',
    '/problems': 'problems',
    '/changes': 'changes',
    '/sla-policies': 'sla_policies',
    '/ola-policies': 'ola_policies',
    '/software-licenses': 'software_licenses',
    '/reports': 'reports',
    '/csat': 'csat',
    '/license': 'license',
    '/email-settings': 'email_settings',
    '/azure-ad': 'azure_ad',
    '/invitations': 'invitations',
    '/storage': 'attachments',
  };

  // Action-specific path mappings (for POST endpoints that perform specific actions)
  private readonly pathActionMap: Record<string, string> = {
    '/assign': 'ASSIGN',
    '/transition': 'TRANSITION',
    '/activate': 'ACTIVATE',
    '/deactivate': 'DEACTIVATE',
    '/submit': 'SUBMIT',
    '/approve': 'APPROVE',
    '/reject': 'REJECT',
    '/complete': 'COMPLETE',
    '/cancel': 'CANCEL',
    '/publish': 'PUBLISH',
    '/archive': 'ARCHIVE',
    '/feedback': 'FEEDBACK',
    '/import': 'IMPORT',
    '/refresh': 'REFRESH',
    '/invalidate-cache': 'INVALIDATE_CACHE',
    '/login': 'LOGIN',
    '/logout': 'LOGOUT',
    '/upload': 'UPLOAD',
  };

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Capture start time
    const startTime = Date.now();

    // Only audit mutating operations
    const method = request.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Check if path should be excluded
    if (this.shouldExclude(request.url)) {
      return next.handle();
    }

    // Extract request metadata upfront
    const ipAddress = this.getClientIp(request);
    const userAgent = request.headers['user-agent'] || 'unknown';
    const authHeader = request.headers['authorization'];

    let responseBody: any = null;
    let errorOccurred = false;
    let errorStatusCode = 500;
    let errorMessage = '';

    return next.handle().pipe(
      tap((body) => {
        responseBody = body;
      }),
      catchError((error) => {
        errorOccurred = true;
        errorStatusCode = error.status || 500;
        errorMessage = error.message || 'Unknown error';
        return error;
      }),
      finalize(() => {
        // Log after response is complete
        const executionTime = Date.now() - startTime;

        // Get status code - check multiple sources
        let statusCode = errorOccurred ? errorStatusCode : response.statusCode;
        if (!statusCode || statusCode === 0) {
          statusCode = response.status || 200;
        }

        // Extract JWT payload and user info
        const jwtPayload = this.extractJwtPayload(request);
        const user = request.user || jwtPayload;

        // Get organization ID from multiple sources
        const organizationId = this.getOrganizationId(request, jwtPayload);

        // Debug logging - enhanced with more detail
        this.logger.debug('Audit interceptor debug', {
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
          // Request user info
          hasRequestUser: !!request.user,
          requestUserKeys: request.user ? Object.keys(request.user) : [],
          requestUserId: request.user?.id,
          requestUserEmail: request.user?.email,
          requestUserRole: request.user?.role,
          // JWT payload info
          hasJwtPayload: !!jwtPayload && Object.keys(jwtPayload).length > 0,
          jwtPayloadKeys: jwtPayload ? Object.keys(jwtPayload) : [],
          jwtSub: jwtPayload?.sub,
          jwtEmail: jwtPayload?.email,
          jwtRole: jwtPayload?.role,
          jwtOrgId: jwtPayload?.organizationId,
          // Organization ID
          hasOrganizationId: !!organizationId,
          organizationId,
          // Request headers
          authHeaderPresent: !!request.headers['authorization'],
          authHeaderPrefix: request.headers['authorization']?.substring(0, 20),
          xOrgHeaderPresent: !!request.headers['x-organization-id'],
          xOrgHeaderValue: request.headers['x-organization-id'],
          // Request properties
          requestOrganizationId: request.organizationId,
        });

        // Additional debug: try to extract user info from any available source
        const userId = user?.id || user?.sub || jwtPayload?.sub || request.userId || undefined;
        const userEmail = user?.email || jwtPayload?.email || request.userEmail || undefined;
        const userRole = user?.role || jwtPayload?.role || request.userRole || undefined;

        // Use logger.log instead of logger.debug to see full data in console
        this.logger.log('Audit user extraction', JSON.stringify({
          extractedUserId: userId,
          extractedUserEmail: userEmail,
          extractedUserRole: userRole,
        }));

        // Map HTTP method to action, but allow URL path to override for action-specific endpoints
        const pathBasedAction = this.extractActionFromPath(request.url, method);
        const action = errorOccurred
          ? `${pathBasedAction}_FAILED`
          : pathBasedAction;

        // Extract file info if this is a file upload
        const fileInfo = this.extractFileInfo(request);

        // Build metadata
        const metadata: any = {};
        if (errorOccurred) {
          metadata.error = errorMessage;
          metadata.httpStatus = errorStatusCode;
        }
        if (fileInfo) {
          metadata.fileName = fileInfo.fileName;
          metadata.fileSize = fileInfo.fileSize;
          metadata.mimeType = fileInfo.mimeType;
        }

        const auditData: AuditLogData = {
          action,
          entityType: this.extractEntityType(request.url),
          entityId: this.extractEntityId(responseBody, request.params),
          organizationId: organizationId,
          userId: userId,
          userEmail: userEmail,
          userRole: userRole,
          method,
          path: request.url,
          ipAddress,
          userAgent,
          executionTimeMs: executionTime,
          statusCode: statusCode || undefined,
          changes: this.extractChanges(request.body, method),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        };

        // Debug log the final audit data
        this.logger.debug('Audit data being saved', { auditData });

        // Don't await - fire and forget
        this.auditService.log(auditData).catch((err) => {
          this.logger.error('Failed to log audit', { error: err, auditData });
        });
      }),
    );
  }

  /**
   * Extract JWT payload from Authorization header
   */
  private extractJwtPayload(request: any): any {
    try {
      const authHeader = request.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {};
      }

      const token = authHeader.substring(7);
      // JWT payload is base64 encoded (middle part of JWT)
      const parts = token.split('.');
      if (parts.length !== 3) {
        return {};
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload;
    } catch (e) {
      return {};
    }
  }

  /**
   * Get organization ID from multiple sources
   */
  private getOrganizationId(request: any, jwtPayload: any): string | undefined {
    // Try in order: request object, headers, JWT payload
    if (request.organizationId) {
      return request.organizationId;
    }
    if (request.headers?.['x-organization-id']) {
      return request.headers['x-organization-id'];
    }
    if (jwtPayload?.organizationId) {
      return jwtPayload.organizationId;
    }
    return undefined;
  }

  /**
   * Check if path should be excluded from audit
   */
  private shouldExclude(url: string): boolean {
    for (const excludePath of this.excludePaths) {
      if (url.includes(excludePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Map HTTP method to audit action
   */
  private mapMethodToAction(method: string): string {
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return method;
    }
  }

  /**
   * Extract entity type from URL path
   */
  private extractEntityType(url: string): string {
    for (const [path, entityType] of Object.entries(this.pathToEntityType)) {
      if (url.includes(path)) {
        return entityType;
      }
    }
    // Fallback: extract from URL
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * Extract entity ID from response body or request params
   */
  private extractEntityId(body: any, params: any): string {
    // Try response body first
    if (body?.id) {
      return body.id;
    }
    if (body?.data?.id) {
      return body.data.id;
    }
    if (body?.item?.id) {
      return body.item.id;
    }
    // Try request params
    if (params?.id) {
      return params.id;
    }
    return 'unknown';
  }

  /**
   * Get client IP address from request headers
   */
  private getClientIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (request.ip) {
      return request.ip;
    }
    if (request.connection?.remoteAddress) {
      return request.connection.remoteAddress;
    }
    if (request.socket?.remoteAddress) {
      return request.socket.remoteAddress;
    }
    return 'unknown';
  }

  /**
   * Extract action from URL path (for action-specific endpoints like /assign, /transition)
   * Falls back to HTTP method mapping if no path action is found
   */
  private extractActionFromPath(url: string, method: string): string {
    // Check if URL contains any action-specific path
    for (const [pathSuffix, action] of Object.entries(this.pathActionMap)) {
      if (url.includes(pathSuffix)) {
        return action;
      }
    }
    // Fall back to method-based action
    return this.mapMethodToAction(method);
  }

  /**
   * Extract changes from request body based on HTTP method
   */
  private extractChanges(body: any, method: string): any {
    if (!body) {
      return undefined;
    }

    switch (method) {
      case 'POST':
        // For CREATE, capture the created data
        return body;
      case 'PUT':
      case 'PATCH':
        // For UPDATE, capture the update data
        return body;
      case 'DELETE':
        // For DELETE, no body typically sent
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Extract file info from multipart form data
   */
  private extractFileInfo(request: any): { fileName: string; fileSize: number; mimeType: string } | null {
    // Check if this is a multipart form request with files
    if (request.file) {
      // Single file upload (from multer)
      return {
        fileName: request.file.originalname || request.file.filename || 'unknown',
        fileSize: request.file.size || 0,
        mimeType: request.file.mimetype || 'unknown',
      };
    }

    if (request.files && Array.isArray(request.files) && request.files.length > 0) {
      // Multiple file upload - log the first file info
      const file = request.files[0];
      return {
        fileName: file.originalname || file.filename || 'unknown',
        fileSize: file.size || 0,
        mimeType: file.mimetype || 'unknown',
      };
    }

    return null;
  }
}

/**
 * Helper to catch errors and continue the stream
 */
function catchError<T>(handler: (error: any) => void): any {
  return (source: Observable<T>) => {
    return new Observable<T>((subscriber) => {
      source.subscribe({
        next: (value) => subscriber.next(value),
        error: (err) => {
          handler(err);
          subscriber.error(err);
        },
        complete: () => subscriber.complete(),
      });
    });
  };
}