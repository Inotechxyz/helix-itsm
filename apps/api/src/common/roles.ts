/**
 * Role-based Access Control Utilities
 *
 * Centralized role definitions and helper functions for consistent RBAC
 * across the application.
 *
 * System Roles (Authentication):
 * - user: Standard user who can login
 * - superadmin: Full system administrator
 *
 * Organization Roles (Authorization) are defined in @helix/shared
 */

import { UserRole, OrganizationRole, OrganizationRoleHierarchy } from '@helix/shared';

/**
 * System role hierarchy - higher number = more permissions
 */
export const RoleHierarchy: Record<UserRole, number> = {
  [UserRole.user]: 1,
  [UserRole.superadmin]: 2,
};

/**
 * System role display names for UI
 */
export const RoleDisplayNames: Record<UserRole, string> = {
  [UserRole.user]: 'User',
  [UserRole.superadmin]: 'Super Admin',
};

/**
 * System role descriptions
 */
export const RoleDescriptions: Record<UserRole, string> = {
  [UserRole.user]: 'Standard user who can login and access the platform',
  [UserRole.superadmin]: 'Full system administrator with complete platform control',
};

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(role: string): boolean {
  return role === UserRole.superadmin;
}

/**
 * Check if user is a standard user (can login)
 */
export function isUser(role: string): boolean {
  return role === UserRole.user || role === UserRole.superadmin;
}

/**
 * Organization role display names for UI
 */
export const OrgRoleDisplayNames: Record<OrganizationRole, string> = {
  [OrganizationRole.ORGADMIN]: 'Organization Admin',
  [OrganizationRole.MANAGER]: 'Manager',
  [OrganizationRole.APPROVER]: 'Approver',
  [OrganizationRole.AGENT]: 'Agent',
  [OrganizationRole.REQUESTER]: 'Requester',
};

/**
 * Organization role descriptions
 */
export const OrgRoleDescriptions: Record<OrganizationRole, string> = {
  [OrganizationRole.ORGADMIN]: 'Full organization administrator with complete control',
  [OrganizationRole.MANAGER]: 'Manage teams, content, and users within the organization',
  [OrganizationRole.APPROVER]: 'Approve or reject service requests',
  [OrganizationRole.AGENT]: 'Handle tickets and execute services',
  [OrganizationRole.REQUESTER]: 'Submit and track requests',
};

/**
 * Check if a user has at least a certain organization role level
 */
export function hasOrgRoleOrHigher(
  userRole: OrganizationRole,
  requiredRole: OrganizationRole
): boolean {
  return OrganizationRoleHierarchy[userRole] >= OrganizationRoleHierarchy[requiredRole];
}

/**
 * Check if an organization role can manage another organization role
 */
export function canManageOrgRole(
  managerRole: OrganizationRole,
  targetRole: OrganizationRole
): boolean {
  return OrganizationRoleHierarchy[managerRole] > OrganizationRoleHierarchy[targetRole];
}

/**
 * Role guard options for NestJS
 */
export interface RoleGuardOptions {
  /**
   * Specific system roles that can access the resource
   */
  allowedRoles?: UserRole[];
}

/**
 * Check if a user can access a resource based on role guard options
 */
export function canAccessResource(
  userRole: string,
  options: RoleGuardOptions,
): boolean {
  if (options.allowedRoles) {
    return options.allowedRoles.includes(userRole as UserRole);
  }
  return true;
}
