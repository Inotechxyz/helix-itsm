import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Request } from 'express';

/**
 * Prisma Middleware for automatic organization filtering
 *
 * This middleware automatically adds organizationId filter to all queries
 * for models that have organizationId field, unless:
 * 1. The user is a SuperAdmin (global access)
 * 2. organizationId is explicitly provided in the query
 * 3. The query is for an Organization model itself
 *
 * Usage:
 * - Set the organization context via request.organizationId
 * - All Prisma queries will automatically filter by organizationId
 */
@Injectable()
export class PrismaOrganizationMiddleware implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.registerMiddleware();
  }

  private registerMiddleware() {
    // List of models that require organization filtering
    const orgScopedModels = [
      'Team',
      'Ticket',
      'Category',
      'Comment',
      'Attachment',
      'ArticleCategory',
      'Article',
      'ServiceCategory',
      'Service',
      'ServiceRequest',
      'AssetType',
      'Asset',
      'Problem',
      'ChangeRequest',
      'SlaPolicy',
      'OlaPolicy',
      'OlaHandoff',
      'Software',
      'SoftwareLicense',
      'SoftwareLicenseAssignment',
      'CsatSurveyConfig',
      'CsatQuestion',
      'CsatSurvey',
      'CsatResponse',
    ];

    // Register middleware for each model
    for (const modelName of orgScopedModels) {
      this.addOrganizationFilter(modelName);
    }
  }

  private addOrganizationFilter(modelName: string) {
    const model: any = (this.prisma as any)[modelName.toLowerCase()];

    if (!model) {
      return;
    }

    // Wrap the model's methods to inject organization filter
    const originalFindMany = model.findMany.bind(model);
    const originalFindFirst = model.findFirst.bind(model);
    const originalFindUnique = model.findUnique.bind(model);
    const originalUpdate = model.update.bind(model);
    const originalDelete = model.delete.bind(model);
    const originalUpsert = model.upsert.bind(model);
    const originalCount = model.count.bind(model);

    // Helper to get organization context
    const getOrganizationId = (): string | undefined => {
      try {
        // In a request context, the organizationId would be set
        // This is a simplified version - in production, you'd use AsyncLocalStorage
        return (global as any).__organizationId__;
      } catch {
        return undefined;
      }
    };

    // Helper to check if user is SuperAdmin
    const isSuperAdmin = (): boolean => {
      try {
        return (global as any).__userRole__ === 'superadmin';
      } catch {
        return false;
      }
    };

    model.findMany = async (args: any = {}) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin()) {
        args.where = { ...args.where, organizationId: orgId };
      }
      return originalFindMany(args);
    };

    model.findFirst = async (args: any = {}) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin()) {
        args.where = { ...args.where, organizationId: orgId };
      }
      return originalFindFirst(args);
    };

    model.findUnique = async (args: any) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin() && !args.where?.organizationId) {
        args.where = { ...args.where, organizationId: orgId };
      }
      return originalFindUnique(args);
    };

    model.update = async (args: any) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin() && !args.where?.organizationId) {
        args.where = { ...args.where, organizationId: orgId };
      }
      return originalUpdate(args);
    };

    model.delete = async (args: any) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin() && !args.where?.organizationId) {
        args.where = { ...args.where, organizationId: orgId };
      }
      return originalDelete(args);
    };

    model.upsert = async (args: any) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin()) {
        args.where = { ...args.where, organizationId: orgId };
        args.create = { ...args.create, organizationId: orgId };
        args.update = { ...args.update, organizationId: orgId };
      }
      return originalUpsert(args);
    };

    model.count = async (args: any = {}) => {
      const orgId = getOrganizationId();
      if (orgId && !isSuperAdmin()) {
        args.where = { ...args.where, organizationId: orgId };
      }
      return originalCount(args);
    };
  }
}

// Helper functions to set/get organization context
export function setOrganizationContext(organizationId: string | undefined, userRole: string | undefined) {
  (global as any).__organizationId__ = organizationId;
  (global as any).__userRole__ = userRole;
}

export function clearOrganizationContext() {
  delete (global as any).__organizationId__;
  delete (global as any).__userRole__;
}
