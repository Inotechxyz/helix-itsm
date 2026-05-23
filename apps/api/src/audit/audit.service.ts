import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditLogData, AuditLogEntry, AuditLogQueryParams, AuditLogExportOptions } from './audit.types';
import { AuditLogQueryDto, AuditLogExportDto } from './dto/audit-log.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log an audit event asynchronously
   * Does not block the response
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          organizationId: data.organizationId,
          userId: data.userId,
          userEmail: data.userEmail,
          userRole: data.userRole,
          changes: data.changes ? JSON.parse(JSON.stringify(data.changes)) : null,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
          method: data.method,
          path: data.path,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          executionTimeMs: data.executionTimeMs,
          statusCode: data.statusCode,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit failures shouldn't break requests
      this.logger.error('Failed to write audit log', { error, data });
    }
  }

  /**
   * Query audit logs with filters and pagination
   */
  async findAll(query: AuditLogQueryDto, requestingUserId?: string, requestingUserOrgId?: string): Promise<{ items: AuditLogEntry[]; total: number; page: number; limit: number }> {
    const { organizationId, userId, entityType, action, startDate, endDate, search, page = 1, limit = 50 } = query;

    // Build where clause
    const where: any = {};

    // Organization scope - orgadmins can only see their org's logs, superadmins see all
    if (organizationId) {
      where.organizationId = organizationId;
    } else if (requestingUserOrgId && requestingUserId) {
      // Regular org admin - restrict to their organization
      where.organizationId = requestingUserOrgId;
    }

    // Filter by user
    if (userId) {
      where.userId = userId;
    }

    // Filter by entity type
    if (entityType) {
      where.entityType = entityType;
    }

    // Filter by action
    if (action) {
      where.action = action;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Search in entityId, userEmail, path
    if (search) {
      where.OR = [
        { entityId: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Execute query with pagination
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items as AuditLogEntry[],
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single audit log entry by ID
   */
  async findOne(id: string): Promise<AuditLogEntry | null> {
    return this.prisma.auditLog.findUnique({
      where: { id },
    }) as Promise<AuditLogEntry | null>;
  }

  /**
   * Get audit logs by entity
   */
  async findByEntity(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<AuditLogEntry[]>;
  }

  /**
   * Export audit logs to CSV or JSON format
   */
  async exportLogs(options: AuditLogExportDto): Promise<{ format: 'csv' | 'json'; data: string }> {
    const where: any = {};

    if (options.organizationId) {
      where.organizationId = options.organizationId;
    }

    if (options.entityType) {
      where.entityType = options.entityType;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = new Date(options.startDate);
      }
      if (options.endDate) {
        where.createdAt.lte = new Date(options.endDate);
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // Limit export to 10k records
    });

    if (options.format === 'csv') {
      return {
        format: 'csv',
        data: this.convertToCsv(logs),
      };
    }

    return {
      format: 'json',
      data: JSON.stringify(logs, null, 2),
    };
  }

  /**
   * Convert logs to CSV format
   */
  private convertToCsv(logs: any[]): string {
    const headers = [
      'ID',
      'Action',
      'Entity Type',
      'Entity ID',
      'Organization ID',
      'User ID',
      'User Email',
      'User Role',
      'Method',
      'Path',
      'IP Address',
      'User Agent',
      'Status Code',
      'Execution Time (ms)',
      'Changes',
      'Metadata',
      'Created At',
    ];

    const rows = logs.map(log => [
      log.id,
      log.action,
      log.entityType,
      log.entityId,
      log.organizationId || '',
      log.userId || '',
      log.userEmail || '',
      log.userRole || '',
      log.method,
      log.path,
      log.ipAddress || '',
      log.userAgent || '',
      log.statusCode || '',
      log.executionTimeMs || '',
      log.changes ? JSON.stringify(log.changes) : '',
      log.metadata ? JSON.stringify(log.metadata) : '',
      log.createdAt.toISOString(),
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Cleanup old audit logs based on retention policy
   * Default retention is 90 days
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} audit logs older than ${retentionDays} days`);
    return result.count;
  }

  /**
   * Get audit statistics for a time period
   * Optimized using Prisma groupBy for efficient aggregation
   */
  async getStats(startDate: string, endDate: string, organizationId?: string): Promise<{
    totalActions: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    byUser: Record<string, number>;
  }> {
    const where: any = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Use Promise.all for parallel queries - more efficient than fetching all logs
    const [totalCount, byActionGroups, byEntityTypeGroups, byUserGroups] = await Promise.all([
      // Total count
      this.prisma.auditLog.count({ where }),
      // Count by action using groupBy
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      }),
      // Count by entity type using groupBy
      this.prisma.auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: { entityType: true },
      }),
      // Count by user using groupBy (only non-null userId)
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: { userId: true },
      }),
    ]);

    // Transform groupBy results into Record<string, number> format
    const byAction: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    byActionGroups.forEach(group => {
      byAction[group.action] = group._count.action;
    });

    byEntityTypeGroups.forEach(group => {
      byEntityType[group.entityType] = group._count.entityType;
    });

    byUserGroups.forEach(group => {
      if (group.userId) {
        byUser[group.userId] = group._count.userId;
      }
    });

    return {
      totalActions: totalCount,
      byAction,
      byEntityType,
      byUser,
    };
  }
}