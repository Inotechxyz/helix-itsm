export interface AuditLogData {
  action: string;
  entityType: string;
  entityId: string;
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  changes?: any;
  metadata?: any;
  method: string;
  path: string;
  ipAddress?: string;
  userAgent?: string;
  executionTimeMs?: number;
  statusCode?: number;
}

export interface AuditLogQueryParams {
  organizationId?: string;
  userId?: string;
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  organizationId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  changes?: any;
  metadata?: any;
  method: string;
  path: string;
  ipAddress?: string;
  userAgent?: string;
  executionTimeMs?: number;
  statusCode?: number;
  createdAt: Date;
}

export interface AuditLogExportOptions {
  format: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  organizationId?: string;
  entityType?: string;
}