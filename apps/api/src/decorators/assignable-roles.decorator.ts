import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '@helix/shared';

/**
 * Decorator to specify which roles can be assigned by the current user
 * Usage: @AssignableRoles('manager', 'agent', 'requester')
 *
 * This decorator defines what org roles the current user is allowed to assign.
 * - orgadmin can assign: manager, approver, agent, requester
 * - manager can assign: agent, requester
 * - others cannot assign any roles
 *
 * For assigning orgadmin role, use @RequireSuperAdmin() decorator
 */
export const ASSIGNABLE_ROLES_KEY = 'assignable_roles';

/**
 * Roles that can be assigned with this route
 */
export const AssignableRoles = (...roles: OrganizationRole[]) =>
  SetMetadata(ASSIGNABLE_ROLES_KEY, roles);
