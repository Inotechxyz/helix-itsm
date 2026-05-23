import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  UserRole,
  OrganizationRole,
  RoleAssignmentRules,
} from '@helix/shared';
import { ASSIGNABLE_ROLES_KEY } from '../decorators/assignable-roles.decorator';

/**
 * Guard to validate role assignment permissions
 *
 * This guard checks if the current user is allowed to assign specific org roles.
 *
 * Rules:
 * - superadmin (system role) can assign any org role
 * - orgadmin can assign: manager, approver, agent, requester
 * - manager can assign: agent, requester
 * - others cannot assign any roles
 */
@Injectable()
export class RoleAssignmentGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    // If no user, deny access
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Get the roles being assigned from the request body
    const targetRole = request.body?.orgRole || request.body?.role;
    if (!targetRole) {
      // No role to assign, allow to proceed (might be other operation)
      return true;
    }

    // Superadmin can assign any role
    if (user.role === UserRole.superadmin) {
      return true;
    }

    // Get the user's org role
    const userOrgRole = request.userOrgRole as OrganizationRole;
    if (!userOrgRole) {
      throw new ForbiddenException(
        'You need an organization role to assign roles',
      );
    }

    // Check if the target role is in the allowed list for this user's org role
    const allowedRoles = RoleAssignmentRules[userOrgRole] || [];

    // Special case: orgadmin assignment requires superadmin
    if (targetRole === OrganizationRole.ORGADMIN) {
      throw new ForbiddenException(
        'Only system administrators can assign the Organization Admin role',
      );
    }

    if (!allowedRoles.includes(targetRole as any)) {
      throw new ForbiddenException(
        `You are not allowed to assign the ${targetRole} role`,
      );
    }

    return true;
  }
}
