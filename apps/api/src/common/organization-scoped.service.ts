import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '@helix/shared';

/**
 * Organization Scoped Service
 *
 * This service provides organization context for the current request.
 * It should be REQUEST scoped so each request gets its own instance.
 *
 * Usage:
 * ```typescript
 * constructor(private orgScoped: OrganizationScopedService) {}
 *
 * // In a method
 * const orgId = this.orgScoped.getOrganizationId();
 * const isSuperAdmin = this.orgScoped.isSuperAdmin();
 * const where = this.orgScoped.applyOrgFilter({ status: 'active' });
 * ```
 */
@Injectable({ scope: Scope.REQUEST })
export class OrganizationScopedService {
  private _organizationId: string | undefined;
  private _organizationSlug: string | undefined;
  private _userOrgRole: string | undefined;
  private _isSuperAdmin: boolean = false;

  constructor(@Inject(REQUEST) private readonly request: Request) {
    this._organizationId = request.organizationId;
    this._organizationSlug = request.organizationSlug;
    this._userOrgRole = request.userOrgRole;
    this._isSuperAdmin = (request.user as any)?.role === UserRole.superadmin;
  }

  /**
   * Get the current organization ID
   */
  getOrganizationId(): string | undefined {
    return this._organizationId;
  }

  /**
   * Get the current organization slug
   */
  getOrganizationSlug(): string | undefined {
    return this._organizationSlug;
  }

  /**
   * Get the user's role in the current organization
   */
  getUserOrgRole(): string | undefined {
    return this._userOrgRole;
  }

  /**
   * Check if the current user is a SuperAdmin (global access)
   */
  isSuperAdmin(): boolean {
    return this._isSuperAdmin;
  }

  /**
   * Check if organization context is available
   */
  hasOrganizationContext(): boolean {
    return !!this._organizationId;
  }

  /**
   * Apply organization filter to a where clause
   * Returns the modified where clause with organizationId
   *
   * @param where - The existing where clause
   * @param forceApply - Apply even if SuperAdmin (for tracking purposes)
   */
  applyOrgFilter<T extends Record<string, any>>(
    where: T,
    forceApply: boolean = false,
  ): T & { organizationId: string } {
    if (!this._organizationId) {
      throw new Error('Organization context not available');
    }

    // SuperAdmin bypasses filter unless forceApply is true
    if (this._isSuperAdmin && !forceApply) {
      return where as T & { organizationId: string };
    }

    return {
      ...where,
      organizationId: this._organizationId,
    };
  }

  /**
   * Create organization filter object
   * Returns undefined if no filter should be applied (SuperAdmin)
   */
  getOrgFilter(): { organizationId: string } | undefined {
    if (this._isSuperAdmin) {
      return undefined; // No filter for SuperAdmin
    }

    if (!this._organizationId) {
      return undefined;
    }

    return { organizationId: this._organizationId };
  }

  /**
   * Check if user has the required org role or higher
   */
  hasOrgRole(requiredRole: string): boolean {
    const roleHierarchy: Record<string, number> = {
      orgadmin: 4,
      manager: 3,
      agent: 2,
      requester: 1,
    };

    const userRoleLevel = roleHierarchy[this._userOrgRole || ''] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }
}
