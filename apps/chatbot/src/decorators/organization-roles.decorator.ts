import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '@helix/shared';

/**
 * Decorator to specify allowed organization roles for a route
 * Usage: @OrganizationRoles('orgadmin', 'manager')
 *
 * If user doesn't have any of the specified roles in the organization,
 * access will be denied.
 *
 * SuperAdmin bypasses this check (global access).
 */
export const ORGANIZATION_ROLES_KEY = 'organization_roles';
export const OrganizationRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);